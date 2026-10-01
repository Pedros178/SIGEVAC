const QRCode = require('qrcode');
const CredencialModel = require('../models/credencialModel');
const QrModel = require('../models/qrModel');
const VoluntarioModel = require('../models/voluntarioModel');
const HoraServicioModel = require('../models/horaServicioModel');
const ParticipacionModel = require('../models/participacionModel');
const PDFDocument = require('pdfkit');

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
          url_verificacion: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/certificado?codigo=${encodeURIComponent(qr.codigo)}`,
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
          url_verificacion: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/certificado?codigo=${encodeURIComponent(qr.codigo)}`,
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
      const voluntario = await QrModel.buscarVoluntarioPorCodigo(req.params.codigo, req.usuario.asociacionId);
      if (!voluntario) return res.status(404).json({ error: 'Código QR no reconocido.' });
      return res.json({ voluntario });
    } catch (err) {
      return next(err);
    }
  },

  async certificadoPublico(req, res, next) {
    try {
      const certificado = await QrModel.obtenerCertificadoPorCodigo(req.params.codigo);
      if (!certificado) return res.status(404).json({ error: 'Certificado no reconocido o voluntario inactivo.' });
      return res.json({ certificado });
    } catch (err) { return next(err); }
  },

  async certificadoPdf(req, res, next) {
    try {
      const certificado = await QrModel.obtenerCertificadoPorCodigo(req.params.codigo);
      if (!certificado) return res.status(404).json({ error: 'Certificado no reconocido o voluntario inactivo.' });

      const documento = new PDFDocument({ size: 'LETTER', margin: 56 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="certificado-${certificado.numero_voluntario}.pdf"`);
      documento.pipe(res);
      documento.fontSize(11).fillColor('#197DA8').text('SIGEVAC', { characterSpacing: 2 });
      documento.moveDown(2);
      documento.fontSize(26).fillColor('#163447').text('Certificado de horas de servicio', { align: 'center' });
      documento.moveDown(1.5);
      documento.fontSize(13).fillColor('#5B7380').text('Se hace constar que', { align: 'center' });
      documento.moveDown(0.5);
      documento.fontSize(22).fillColor('#163447').text(`${certificado.nombre} ${certificado.apellido_paterno || ''} ${certificado.apellido_materno || ''}`.trim(), { align: 'center' });
      documento.moveDown(0.7);
      documento.fontSize(12).fillColor('#5B7380').text(`Folio ${certificado.numero_voluntario} · ${certificado.asociacion_nombre}`, { align: 'center' });
      documento.moveDown(2);
      documento.fontSize(16).fillColor('#163447').text(`${certificado.total_horas} horas acumuladas`, { align: 'center' });
      documento.moveDown(1);
      documento.fontSize(11).fillColor('#5B7380').text('Detalle por periodo', { align: 'left' });
      certificado.detalle.forEach((fila) => documento.fontSize(11).fillColor('#163447').text(`${fila.periodo} · ${fila.tipo}: ${fila.horas} horas`));
      documento.moveDown(2);
      documento.fontSize(9).fillColor('#5B7380').text(`Documento verificable · Emitido el ${new Date().toLocaleDateString('es-MX')}`);
      documento.end();
    } catch (err) { return next(err); }
  },

  async registrarAsistenciaPorCodigo(req, res, next) {
    try {
      const { actividad_id: actividadId } = req.body;
      if (!actividadId) return res.status(400).json({ error: 'actividad_id es obligatorio.' });
      const resultado = await ParticipacionModel.asistenciaPorQr(req.params.codigo, actividadId, req.usuario.asociacionId);
      if (!resultado) return res.status(404).json({ error: 'Código no reconocido, voluntario inactivo o no está inscrito en esta actividad.' });
      if (resultado.yaFinalizada) return res.status(409).json({ error: 'La asistencia de esta actividad ya tiene entrada y salida registradas.' });
      return res.json({ mensaje: resultado.tipo === 'entrada' ? 'Entrada registrada.' : 'Salida registrada.', ...resultado });
    } catch (err) { return next(err); }
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
