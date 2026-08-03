const NotificacionModel = require('../models/notificacionModel');

const NotificacionController = {
  /**
   * GET /api/notificaciones
   */
  async listar(req, res, next) {
    try {
      const { soloNoLeidas } = req.query;
      const notificaciones = await NotificacionModel.listarPorUsuario(req.usuario.id, {
        soloNoLeidas: soloNoLeidas === 'true',
      });
      const noLeidas = await NotificacionModel.contarNoLeidas(req.usuario.id);
      return res.json({ notificaciones, no_leidas: noLeidas });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * PATCH /api/notificaciones/:id/leida
   */
  async marcarLeida(req, res, next) {
    try {
      const notificacion = await NotificacionModel.marcarLeida(req.params.id, req.usuario.id);
      if (!notificacion) return res.status(404).json({ error: 'Notificación no encontrada.' });
      return res.json({ notificacion });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = NotificacionController;
