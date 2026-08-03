const { ExpedienteModel, DocumentoModel } = require('../models/expedienteModel');
const VoluntarioModel = require('../models/voluntarioModel');
const {
  notificarDocumentoRechazado,
  notificarExpedienteAprobado,
  notificarDocumentoFaltante,
} = require('../services/notificacionService');

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

      if (expediente.estado === 'completo') {
        const voluntario = await VoluntarioModel.obtenerPorId(expediente.voluntario_id);
        if (voluntario) notificarExpedienteAprobado({ voluntario }); // best-effort, no bloquea la respuesta
      }

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

      const documentoConTipo = await DocumentoModel.obtenerPorId(documento.id);
      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);

      const voluntario = await VoluntarioModel.obtenerPorId(expediente.voluntario_id);
      if (voluntario) notificarDocumentoRechazado({ voluntario, documento: documentoConTipo }); // best-effort

      return res.json({ documento, expediente });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/voluntarios/:voluntarioId/expediente/notificar-faltantes
   * Envía (best-effort) un recordatorio por correo de cada documento aún
   * pendiente del expediente — Módulo 17.
   */
  async notificarFaltantes(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.params.voluntarioId);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const expediente = await ExpedienteModel.obtenerPorVoluntario(voluntario.id);
      if (!expediente) return res.status(404).json({ error: 'Este voluntario no tiene expediente.' });

      const documentos = await DocumentoModel.listarPorExpediente(expediente.id);
      const faltantes = documentos.filter((d) => d.estado === 'pendiente');

      await Promise.all(faltantes.map((documento) => notificarDocumentoFaltante({ voluntario, documento })));

      return res.json({ notificados: faltantes.length });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ExpedienteController;
