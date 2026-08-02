const QRCode = require('qrcode');
const CredencialModel = require('../models/credencialModel');
const QrModel = require('../models/qrModel');
const VoluntarioModel = require('../models/voluntarioModel');
const HoraServicioModel = require('../models/horaServicioModel');

const CredencialController = {
  /**
   * POST /api/voluntarios/:id/credencial  — genera o renueva la credencial y su QR
   */
  async generar(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.params.id);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const [credencial, qr] = await Promise.all([
        CredencialModel.generar(req.params.id),
        QrModel.obtenerOCrear(req.params.id),
      ]);

      const qrDataUrl = await QRCode.toDataURL(qr.codigo, { margin: 1, width: 240 });

      return res.status(201).json({
        credencial: {
          ...credencial,
          numero_voluntario: voluntario.numero_voluntario,
          nombre: `${voluntario.nombre} ${voluntario.apellido_paterno || ''}`.trim(),
          qr_codigo: qr.codigo,
          qr_imagen: qrDataUrl,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:id/credencial
   */
  async obtener(req, res, next) {
    try {
      const [voluntario, credencial, qr] = await Promise.all([
        VoluntarioModel.obtenerPorId(req.params.id),
        CredencialModel.obtenerPorVoluntario(req.params.id),
        QrModel.obtenerOCrear(req.params.id),
      ]);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      if (!credencial) return res.status(404).json({ error: 'Este voluntario aún no tiene una credencial generada.' });

      const qrDataUrl = await QRCode.toDataURL(qr.codigo, { margin: 1, width: 240 });

      return res.json({
        credencial: {
          ...credencial,
          numero_voluntario: voluntario.numero_voluntario,
          nombre: `${voluntario.nombre} ${voluntario.apellido_paterno || ''}`.trim(),
          qr_codigo: qr.codigo,
          qr_imagen: qrDataUrl,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/qr/:codigo  — valida identidad escaneando la credencial
   */
  async validarPorCodigo(req, res, next) {
    try {
      const voluntario = await QrModel.buscarVoluntarioPorCodigo(req.params.codigo);
      if (!voluntario) return res.status(404).json({ error: 'Código QR no reconocido.' });
      return res.json({ voluntario });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:id/horas-servicio
   */
  async resumenHoras(req, res, next) {
    try {
      const resumen = await HoraServicioModel.resumenPorVoluntario(req.params.id);
      return res.json(resumen);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = CredencialController;
