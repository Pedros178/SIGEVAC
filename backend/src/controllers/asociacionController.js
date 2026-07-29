const AsociacionModel = require('../models/asociacionModel');

const AsociacionController = {
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
};

module.exports = AsociacionController;
