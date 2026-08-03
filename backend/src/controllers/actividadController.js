const ActividadModel = require('../models/actividadModel');
const ParticipacionModel = require('../models/participacionModel');
const { notificarNuevaActividad } = require('../services/notificacionService');

const ActividadController = {
  async listar(req, res, next) {
    try {
      const { desde, hasta, limit = 50, offset = 0 } = req.query;
      const actividades = await ActividadModel.listar({
        asociacionId: req.usuario.asociacionId, desde, hasta, limit: Number(limit), offset: Number(offset),
      });
      return res.json({ actividades });
    } catch (err) {
      return next(err);
    }
  },

  async crear(req, res, next) {
    try {
      const { nombre, fecha, lugar, responsableId, descripcion, cupo } = req.body;
      if (!nombre || !fecha) {
        return res.status(400).json({ error: 'nombre y fecha son obligatorios.' });
      }
      const actividad = await ActividadModel.crear({
        asociacionId: req.usuario.asociacionId, nombre, fecha, lugar, responsableId, descripcion, cupo,
      });
      notificarNuevaActividad({ actividad, asociacionId: req.usuario.asociacionId }); // best-effort
      return res.status(201).json({ actividad });
    } catch (err) {
      return next(err);
    }
  },

  async obtener(req, res, next) {
    try {
      const actividad = await ActividadModel.obtenerPorId(req.params.id);
      if (!actividad) return res.status(404).json({ error: 'Actividad no encontrada.' });
      const [participantes, evidencias] = await Promise.all([
        ParticipacionModel.listarPorActividad(actividad.id),
        ActividadModel.listarEvidencias(actividad.id),
      ]);
      return res.json({ actividad: { ...actividad, participantes, evidencias } });
    } catch (err) {
      return next(err);
    }
  },

  async actualizar(req, res, next) {
    try {
      const actividad = await ActividadModel.actualizar(req.params.id, req.body);
      if (!actividad) return res.status(404).json({ error: 'Actividad no encontrada.' });
      return res.json({ actividad });
    } catch (err) {
      return next(err);
    }
  },

  async agregarEvidencia(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "evidencia").' });
      }
      const actividad = await ActividadModel.obtenerPorId(req.params.id);
      if (!actividad) {
        require('fs').unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Actividad no encontrada.' });
      }
      const evidencia = await ActividadModel.agregarEvidencia(req.params.id, {
        url: `/uploads/${req.file.filename}`,
        descripcion: req.body.descripcion,
      });
      return res.status(201).json({ evidencia });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ActividadController;
