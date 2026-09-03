const InsigniaModel = require('../models/insigniaModel');
const { evaluarInsignias, calcularNivel } = require('../services/gamificacionService');

const InsigniaController = {
  /** GET /api/insignias — catálogo completo, para mostrar el "próximo objetivo" */
  async listarCatalogo(req, res, next) {
    try {
      const insignias = await InsigniaModel.listarCatalogo();
      return res.json({ insignias });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/voluntarios/:voluntarioId/insignias */
  async listarPorVoluntario(req, res, next) {
    try {
      const [insignias, metricas] = await Promise.all([
        InsigniaModel.listarPorVoluntario(req.params.voluntarioId),
        InsigniaModel.obtenerMetricas(req.params.voluntarioId),
      ]);
      const nivel = calcularNivel(metricas.horas_totales);
      return res.json({ insignias, nivel, metricas });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/voluntarios/:voluntarioId/insignias/recalcular
   * Reevalúa manualmente el progreso (útil tras cargar datos históricos,
   * o si un administrador quiere forzar la revisión sin esperar a la
   * siguiente asistencia registrada).
   */
  async recalcular(req, res, next) {
    try {
      const nuevas = await evaluarInsignias(req.params.voluntarioId);
      return res.json({ nuevas_insignias: nuevas });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = InsigniaController;
