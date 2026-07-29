const UsuarioModel = require('../models/usuarioModel');
const RolModel = require('../models/rolModel');
const { hashPassword } = require('../utils/password');

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
      const roles = await UsuarioModel.obtenerRoles(usuario.id);
      return res.json({ usuario: { ...usuario, roles } });
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
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
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
};

module.exports = UsuarioController;
