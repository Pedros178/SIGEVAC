const DashboardModel = require('../models/dashboardModel');

const DashboardController = {
  /**
   * GET /api/dashboard
   */
  async obtener(req, res, next) {
    try {
      const indicadores = await DashboardModel.obtenerIndicadores(req.usuario.asociacionId);
      return res.json({ indicadores });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = DashboardController;
