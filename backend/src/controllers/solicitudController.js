const SolicitudModel = require('../models/solicitudModel');
const { esCorreoValido, longitudValida } = require('../utils/validadores');

const SolicitudController = {
  async crear(req, res, next) {
    try {
      const { nombre, correo, telefono, mensaje } = req.body;
      if (!nombre || !correo) return res.status(400).json({ error: 'nombre y correo son obligatorios.' });
      if (!esCorreoValido(correo)) return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
      if (!longitudValida(nombre, 200) || !longitudValida(telefono, 30) || !longitudValida(mensaje, 2000)) {
        return res.status(400).json({ error: 'Alguno de los campos excede la longitud permitida.' });
      }
      // Aviso de privacidad (LFPDPPP): sin aceptarlo no se recaban datos personales. Se deja constancia de la versión y la fecha.
      if (req.body.acepta_aviso_privacidad !== true) {
        return res.status(400).json({ error: 'Debes aceptar el aviso de privacidad para enviar tu solicitud.', code: 'AVISO_PRIVACIDAD_REQUERIDO' });
      }
      const solicitud = await SolicitudModel.crear({
        asociacionId: req.body.asociacion_id, nombre, correo, telefono, mensaje,
        versionAviso: process.env.AVISO_PRIVACIDAD_VERSION || '2026-1',
      });
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
