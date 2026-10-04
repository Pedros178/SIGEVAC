const AsociacionModel = require('../models/asociacionModel');

const AsociacionController = {
  /**
   * GET /api/asociacion/publicas
   * SIN autenticación (a propósito): solo expone id y nombre de las
   * asociaciones activas, para que el formulario público de solicitud de
   * voluntariado (Módulo de Solicitudes) sepa a cuál está aplicando la
   * persona. No expone RFC, dirección, ni ningún otro dato sensible.
   */
  async listarPublicas(req, res, next) {
    try {
      const todas = await AsociacionModel.listar();
      const publicas = todas.filter((a) => a.activo !== false).map((a) => ({ id: a.id, nombre: a.nombre }));
      return res.json({ asociaciones: publicas });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/asociacion
   * Devuelve los datos de la asociación del usuario autenticado.
   */
  async obtenerActual(req, res, next) {
    try {
      if (!req.usuario.asociacionId) {
        return res.status(404).json({ error: 'El usuario no tiene una asociación asignada.' });
      }
      const asociacion = await AsociacionModel.obtener(req.usuario.asociacionId);
      if (!asociacion) return res.status(404).json({ error: 'Asociación no encontrada.' });
      return res.json({ asociacion });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * PUT /api/asociacion
   */
  async actualizar(req, res, next) {
    try {
      if (!req.usuario.asociacionId) {
        return res.status(404).json({ error: 'El usuario no tiene una asociación asignada.' });
      }
      const asociacion = await AsociacionModel.actualizar(req.usuario.asociacionId, req.body);
      return res.json({ asociacion });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/asociaciones
   * Listado global — reservado para super_admin (preparación multi-asociación).
   */
  async listarTodas(req, res, next) {
    try {
      const asociaciones = await AsociacionModel.listar();
      return res.json({ asociaciones });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/asociacion
   * Módulo 3 — Registro de asociaciones civiles. Reservado a super_admin:
   * dar de alta una nueva asociación es lo que habilita realmente el
   * escenario multi-asociación (sin esto, "usuario_asociaciones" no tiene
   * a qué más apuntar más allá de la asociación original).
   */
  async crear(req, res, next) {
    try {
      const { nombre } = req.body || {};
      if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre de la asociación es obligatorio.' });
      }
      // Todo campo de texto de la asociación debe ser realmente texto (antes un
      // arreglo u objeto llegaba a la base de datos o provocaba un 500).
      for (const [campo, valor] of Object.entries(req.body)) {
        if (valor !== null && valor !== undefined && typeof valor !== 'string' && typeof valor !== 'boolean') {
          return res.status(400).json({ error: `El campo "${campo}" debe ser texto.` });
        }
      }
      const asociacion = await AsociacionModel.crear(req.body);
      return res.status(201).json({ asociacion });
    } catch (err) {
      if (err.status === 409) return res.status(409).json({ error: err.message });
      return next(err);
    }
  },
};

module.exports = AsociacionController;
