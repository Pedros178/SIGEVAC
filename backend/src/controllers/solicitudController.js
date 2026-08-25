const SolicitudModel = require('../models/solicitudModel');
const SolicitudController = {
  async crear(req, res, next) {
    try {
      const { nombre, correo, telefono, mensaje } = req.body;
      if (!nombre || !correo) return res.status(400).json({ error: 'nombre y correo son obligatorios.' });
      const solicitud = await SolicitudModel.crear({ asociacionId: req.body.asociacion_id, nombre, correo, telefono, mensaje });
      return res.status(201).json({ solicitud });
    } catch (err) { return next(err); }
  },
  async listar(req, res, next) { try { return res.json({ solicitudes: await SolicitudModel.listar(req.usuario.asociacionId, req.query.estado) }); } catch (err) { return next(err); } },
  async actualizarEstado(req, res, next) {
    try {
      if (!['pendiente', 'en_revision', 'aprobada', 'rechazada'].includes(req.body.estado)) return res.status(400).json({ error: 'Estado inválido.' });
      const solicitud = await SolicitudModel.actualizarEstado(req.params.id, req.usuario.asociacionId, req.body.estado, req.usuario.id);
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      return res.json({ solicitud });
    } catch (err) { return next(err); }
  },
};
module.exports = SolicitudController;
