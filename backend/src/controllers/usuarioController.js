const UsuarioModel = require('../models/usuarioModel');
const RolModel = require('../models/rolModel');
const SesionModel = require('../models/sesionModel');
const { hashPassword, validarFortalezaPassword } = require('../utils/password');
const { esCorreoValido } = require('../utils/validadores');
const { esUuid } = require('../utils/identificadores');
const { leerPaginacion } = require('../utils/paginacion');

const esSuperAdminActor = (req) => (req.usuario.roles || []).some((r) => (r.nombre || r) === 'super_admin');

/**
 * Carga al usuario objetivo y comprueba que el solicitante tenga alcance sobre
 * él: debe pertenecer a la MISMA asociación activa (un super_admin puede
 * operar sobre cualquiera, porque su función es transversal). Responde 404
 * —no 403— para no revelar si el id existe en otra asociación.
 * Devuelve el usuario, o null si ya respondió con error.
 */
async function cargarUsuarioEnAlcance(req, res) {
  const { id } = req.params;
  if (!esUuid(id)) { res.status(400).json({ error: 'Identificador de usuario inválido.' }); return null; }
  const usuario = await UsuarioModel.buscarPorId(id);
  const enAlcance = usuario && (esSuperAdminActor(req) || await UsuarioModel.estaEnAsociacion(id, req.usuario.asociacionId));
  if (!enAlcance) { res.status(404).json({ error: 'Usuario no encontrado.' }); return null; }
  return usuario;
}

/**
 * Un usuario solo puede otorgar roles que no le den más poder del que él
 * mismo tiene: el rol super_admin solo lo asigna otro super_admin, y
 * cualquier otro rol debe tener sus permisos contenidos en los del solicitante.
 * (Antes un 'presidente' podía crear un super_admin y obtener respaldos
 * completos de la base y acceso a todas las asociaciones.)
 */
async function puedeAsignarRol(req, rol) {
  if (esSuperAdminActor(req)) return true;
  if (rol.nombre === 'super_admin') return false;
  const [permisosRol, permisosActor] = await Promise.all([
    RolModel.obtenerPermisos(rol.id),
    UsuarioModel.obtenerPermisos(req.usuario.id),
  ]);
  const propios = new Set(permisosActor);
  return permisosRol.every((p) => propios.has(p.clave));
}

const UsuarioController = {
  /**
   * GET /api/usuarios
   */
  async listar(req, res, next) {
    try {
      const { limit, offset } = leerPaginacion(req.query);
      const usuarios = await UsuarioModel.listar({
        asociacionId: req.usuario.asociacionId,
        limit,
        offset,
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
      const usuario = await cargarUsuarioEnAlcance(req, res);
      if (!usuario) return null;
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
      const { nombre, correo, password, rol } = req.body || {};
      if ([nombre, correo, password, rol].some((v) => typeof v !== 'string' || !v.trim())) {
        return res.status(400).json({ error: 'nombre, correo, password y rol son obligatorios (texto).' });
      }
      if (nombre.trim().length > 150) return res.status(400).json({ error: 'El nombre no puede exceder 150 caracteres.' });
      if (!esCorreoValido(correo) || correo.length > 150) return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
      const errorFortaleza = validarFortalezaPassword(password);
      if (errorFortaleza) {
        return res.status(400).json({ error: errorFortaleza });
      }

      const rolEncontrado = await RolModel.buscarPorNombre(rol);
      if (!rolEncontrado) {
        return res.status(400).json({ error: `El rol "${rol}" no existe.` });
      }
      if (!(await puedeAsignarRol(req, rolEncontrado))) {
        return res.status(403).json({ error: 'No puedes asignar un rol con más permisos que los tuyos.' });
      }

      const existente = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      if (existente) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
      }

      const passwordHash = await hashPassword(password);
      const nuevoUsuario = await UsuarioModel.crear({
        nombre: nombre.trim(),
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
      const { nombre, activo } = req.body || {};
      if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150)) {
        return res.status(400).json({ error: 'nombre debe ser texto de 1 a 150 caracteres.' });
      }
      if (activo !== undefined && typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'activo debe ser true o false.' });
      }

      const objetivo = await cargarUsuarioEnAlcance(req, res);
      if (!objetivo) return null;

      // Un usuario con privilegios inferiores no puede tocar a un super_admin
      if (!esSuperAdminActor(req) && await UsuarioModel.esSuperAdmin(objetivo.id)) {
        return res.status(403).json({ error: 'No tienes permisos para modificar a un super administrador.' });
      }
      if (activo === false) {
        if (objetivo.id === req.usuario.id) {
          return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
        }
        if (objetivo.activo && await UsuarioModel.esSuperAdmin(objetivo.id) && await UsuarioModel.contarSuperAdminsActivos() <= 1) {
          return res.status(400).json({ error: 'No se puede desactivar al último super administrador activo.' });
        }
      }

      const usuario = await UsuarioModel.actualizar(objetivo.id, { nombre: nombre?.trim(), activo });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      // Desactivar corta también sus sesiones de refresh (el access token ya
      // se invalida solo: el middleware revalida `activo` en cada petición).
      if (activo === false) await SesionModel.revocarTodasDeUsuario(objetivo.id);
      return res.json({ usuario });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/usuarios/:id/2fa/reset  (solo super_admin)
   * Recuperación cuando un usuario pierde su dispositivo de 2FA: lo desactiva
   * y cierra sus sesiones. El usuario podrá configurarlo de nuevo.
   */
  async reiniciar2FA(req, res, next) {
    try {
      const objetivo = await cargarUsuarioEnAlcance(req, res);
      if (!objetivo) return null;
      await UsuarioModel.guardarConfiguracion2FA(objetivo.id, null, false);
      await SesionModel.revocarTodasDeUsuario(objetivo.id);
      return res.json({ mensaje: 'Autenticación de dos factores reiniciada para el usuario.' });
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
      if (!esUuid(req.params.rolId)) return res.status(400).json({ error: 'Identificador de rol inválido.' });
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
      const objetivo = await cargarUsuarioEnAlcance(req, res);
      if (!objetivo) return null;
      const asociaciones = await UsuarioModel.obtenerAsociaciones(objetivo.id);
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
      if (!esUuid(asociacionId) || !esUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });

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
      if (!esUuid(req.params.id) || !esUuid(req.params.asociacionId)) return res.status(400).json({ error: 'Identificador inválido.' });
      await UsuarioModel.quitarAsociacion(req.params.id, req.params.asociacionId);
      const asociaciones = await UsuarioModel.obtenerAsociaciones(req.params.id);
      return res.json({ asociaciones });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = UsuarioController;
