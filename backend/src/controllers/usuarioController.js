const UsuarioModel = require('../models/usuarioModel');
const RolModel = require('../models/rolModel');
const { hashPassword, validarFortalezaPassword } = require('../utils/password');

const UsuarioController = {
  /**
   * GET /api/usuarios
   */
  async listar(req, res, next) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const usuarios = await UsuarioModel.listar({
        asociacionId: req.usuario.asociacionId,
        limit: Number(limit),
        offset: Number(offset),
      });
      return res.json({ usuarios });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/usuarios/:id
   */
  async obtener(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarPorId(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      const [roles, asociaciones] = await Promise.all([
        UsuarioModel.obtenerRoles(usuario.id),
        UsuarioModel.obtenerAsociaciones(usuario.id),
      ]);
      return res.json({ usuario: { ...usuario, roles, asociaciones } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/usuarios
   * Crea un nuevo usuario del sistema y le asigna un rol.
   */
  async crear(req, res, next) {
    try {
      const { nombre, correo, password, rol } = req.body;
      if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ error: 'nombre, correo, password y rol son obligatorios.' });
      }
      const errorFortaleza = validarFortalezaPassword(password);
      if (errorFortaleza) {
        return res.status(400).json({ error: errorFortaleza });
      }

      const rolEncontrado = await RolModel.buscarPorNombre(rol);
      if (!rolEncontrado) {
        return res.status(400).json({ error: `El rol "${rol}" no existe.` });
      }

      const existente = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      if (existente) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
      }

      const passwordHash = await hashPassword(password);
      const nuevoUsuario = await UsuarioModel.crear({
        nombre,
        correo: correo.toLowerCase().trim(),
        passwordHash,
        asociacionId: req.usuario.asociacionId,
      });
      await UsuarioModel.asignarRol(nuevoUsuario.id, rolEncontrado.id);

      return res.status(201).json({ usuario: { ...nuevoUsuario, rol } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * PUT /api/usuarios/:id
   */
  async actualizar(req, res, next) {
    try {
      const { nombre, activo } = req.body;
      const usuario = await UsuarioModel.actualizar(req.params.id, { nombre, activo });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json({ usuario });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/usuarios/roles/disponibles
   */
  async listarRoles(req, res, next) {
    try {
      const roles = await RolModel.listar();
      return res.json({ roles });
    } catch (err) {
      return next(err);
    }
  },

  async listarPermisos(req, res, next) {
    try { return res.json({ permisos: await RolModel.listarPermisos() }); } catch (err) { return next(err); }
  },

  async crearRol(req, res, next) {
    try {
      const nombre = String(req.body.nombre || '').trim().toLowerCase();
      if (!/^[a-z][a-z0-9_.-]{2,49}$/.test(nombre)) {
        return res.status(400).json({ error: 'El nombre debe tener entre 3 y 50 caracteres y solo usar letras, números, punto, guion o guion bajo.' });
      }
      if (await RolModel.buscarPorNombre(nombre)) return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
      const rol = await RolModel.crear({ nombre, descripcion: req.body.descripcion });
      return res.status(201).json({ rol });
    } catch (err) { return next(err); }
  },

  async actualizarPermisosRol(req, res, next) {
    try {
      const rol = await RolModel.buscarPorId(req.params.rolId);
      if (!rol) return res.status(404).json({ error: 'Rol no encontrado.' });
      if (['super_admin', 'presidente', 'coordinador', 'capturista', 'supervisor', 'consulta'].includes(rol.nombre)) {
        return res.status(400).json({ error: 'Los roles base no se pueden modificar. Crea un rol personalizado.' });
      }
      const permisos = req.body.permisos_ids;
      if (!Array.isArray(permisos) || permisos.some((id) => typeof id !== 'string')) {
        return res.status(400).json({ error: 'permisos_ids debe ser un arreglo de identificadores.' });
      }
      await RolModel.reemplazarPermisos(rol.id, permisos);
      return res.json({ rol, permisos: await RolModel.obtenerPermisos(rol.id) });
    } catch (err) { return next(err); }
  },

  async listarPermisosRol(req, res, next) {
    try {
      const rol = await RolModel.buscarPorId(req.params.rolId);
      if (!rol) return res.status(404).json({ error: 'Rol no encontrado.' });
      return res.json({ permisos: await RolModel.obtenerPermisos(rol.id) });
    } catch (err) { return next(err); }
  },

  // ---------------------------------------------------------------
  // Multi-asociación (diferenciador): un usuario puede pertenecer a
  // más de una asociación civil. Gestión reservada a super_admin
  // porque cruza el aislamiento de datos entre asociaciones.
  // ---------------------------------------------------------------

  /**
   * GET /api/usuarios/:id/asociaciones
   */
  async listarAsociaciones(req, res, next) {
    try {
      const asociaciones = await UsuarioModel.obtenerAsociaciones(req.params.id);
      return res.json({ asociaciones });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/usuarios/:id/asociaciones
   * body: { asociacion_id, es_predeterminada? }
   */
  async agregarAsociacion(req, res, next) {
    try {
      const { asociacion_id: asociacionId, es_predeterminada: esPredeterminada } = req.body;
      if (!asociacionId) return res.status(400).json({ error: 'Falta asociacion_id.' });

      const usuario = await UsuarioModel.buscarPorId(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

      await UsuarioModel.asignarAsociacion(req.params.id, asociacionId, !!esPredeterminada);
      const asociaciones = await UsuarioModel.obtenerAsociaciones(req.params.id);
      return res.status(201).json({ asociaciones });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * DELETE /api/usuarios/:id/asociaciones/:asociacionId
   */
  async quitarAsociacion(req, res, next) {
    try {
      await UsuarioModel.quitarAsociacion(req.params.id, req.params.asociacionId);
      const asociaciones = await UsuarioModel.obtenerAsociaciones(req.params.id);
      return res.json({ asociaciones });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = UsuarioController;
