const { ExpedienteModel, DocumentoModel } = require('../models/expedienteModel');
const VoluntarioModel = require('../models/voluntarioModel');

const ExpedienteController = {
  /**
   * GET /api/voluntarios/:voluntarioId/expediente
   * Devuelve el expediente con su semáforo, porcentaje y lista de documentos.
   */
  async obtener(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.params.voluntarioId);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const expediente = await ExpedienteModel.obtenerPorVoluntario(voluntario.id);
      if (!expediente) return res.status(404).json({ error: 'Este voluntario no tiene expediente.' });

      const documentos = await DocumentoModel.listarPorExpediente(expediente.id);
      return res.json({ expediente: { ...expediente, documentos } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/documentos/:id/aprobar
   */
  async aprobarDocumento(req, res, next) {
    try {
      const documento = await DocumentoModel.actualizarEstado(req.params.id, {
        estado: 'aprobado',
        observaciones: req.body.observaciones,
        vigenciaHasta: req.body.vigenciaHasta,
      });
      if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);
      return res.json({ documento, expediente });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/documentos/:id/rechazar
   */
  async rechazarDocumento(req, res, next) {
    try {
      if (!req.body.observaciones) {
        return res.status(400).json({ error: 'Debes indicar el motivo del rechazo en "observaciones".' });
      }
      const documento = await DocumentoModel.actualizarEstado(req.params.id, {
        estado: 'rechazado',
        observaciones: req.body.observaciones,
      });
      if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);
      return res.json({ documento, expediente });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ExpedienteController;
