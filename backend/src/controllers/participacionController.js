const ParticipacionModel = require('../models/participacionModel');
const AsistenciaModel = require('../models/asistenciaModel');

const ParticipacionController = {
  /**
   * POST /api/actividades/:actividadId/participaciones
   */
  async inscribir(req, res, next) {
    try {
      const { voluntarioId } = req.body;
      if (!voluntarioId) return res.status(400).json({ error: 'voluntarioId es obligatorio.' });
      const participacion = await ParticipacionModel.inscribir(req.params.actividadId, voluntarioId);
      return res.status(201).json({ participacion });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/actividades/:actividadId/participaciones
   */
  async listarPorActividad(req, res, next) {
    try {
      const participantes = await ParticipacionModel.listarPorActividad(req.params.actividadId);
      return res.json({ participantes });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:voluntarioId/participaciones
   */
  async listarPorVoluntario(req, res, next) {
    try {
      const participaciones = await ParticipacionModel.listarPorVoluntario(req.params.voluntarioId);
      return res.json({ participaciones });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * DELETE /api/participaciones/:id
   */
  async cancelar(req, res, next) {
    try {
      await ParticipacionModel.cancelar(req.params.id);
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/participaciones/:id/entrada
   */
  async registrarEntrada(req, res, next) {
    try {
      const asistencia = await AsistenciaModel.registrarEntrada(req.params.id);
      return res.json({ asistencia });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/participaciones/:id/salida
   */
  async registrarSalida(req, res, next) {
    try {
      const participacion = await ParticipacionModel.obtenerPorId(req.params.id);
      if (!participacion) return res.status(404).json({ error: 'Participación no encontrada.' });

      const asistencia = await AsistenciaModel.registrarSalida(
        req.params.id,
        participacion.voluntario_id,
        req.body.observaciones
      );
      return res.json({ asistencia });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ParticipacionController;
