const { query } = require('../config/database');
const { ExpedienteModel, DocumentoModel } = require('../models/expedienteModel');
const VoluntarioModel = require('../models/voluntarioModel');
const ArchivoModel = require('../models/archivoModel');
const { generarTokenPortal } = require('../utils/jwt');
const { enviarCorreo } = require('../utils/email');
const { almacenamientoRemoto, guardarArchivo } = require('../config/storage');

const PortalController = {
  /**
   * POST /api/portal/solicitar-acceso
   * Busca un voluntario por su propio correo, o por el correo de su tutor
   * (para menores de edad), y envía un enlace de acceso de un solo destino
   * válido por 24 horas. Responde igual exista o no la cuenta, por seguridad.
   */
  async solicitarAcceso(req, res, next) {
    try {
      const { correo } = req.body;
      if (!correo) return res.status(400).json({ error: 'El correo es obligatorio.' });

      const correoNormalizado = correo.toLowerCase().trim();
      const { rows } = await query(
        `SELECT v.id, v.nombre, v.correo AS correo_propio, t.correo AS correo_tutor
         FROM voluntarios v
         LEFT JOIN tutores t ON t.voluntario_id = v.id
         WHERE lower(v.correo) = $1 OR lower(t.correo) = $1
         LIMIT 1`,
        [correoNormalizado]
      );

      if (rows.length > 0) {
        const voluntario = rows[0];
        const token = generarTokenPortal(voluntario.id);
        const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal?token=${token}`;

        const resultado = await enviarCorreo({
          to: correoNormalizado,
          subject: 'SIGEVAC — Acceso a tu expediente de voluntariado',
          html: `<p>Hola,</p><p>Aquí tienes tu enlace de acceso al expediente de ${voluntario.nombre} (válido por 24 horas):</p><p><a href="${enlace}">${enlace}</a></p>`,
        });

        if (process.env.NODE_ENV === 'development' && !resultado.enviado) {
          console.log(`[DEV] Enlace de acceso al portal: ${enlace}`);
        }
      }

      return res.json({ mensaje: 'Si el correo está registrado, se envió un enlace de acceso.' });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/portal/expediente
   */
  async obtenerExpediente(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.portalVoluntarioId);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const expediente = await ExpedienteModel.obtenerPorVoluntario(voluntario.id);
      const documentos = expediente ? await DocumentoModel.listarPorExpediente(expediente.id) : [];

      return res.json({ voluntario, expediente: expediente ? { ...expediente, documentos } : null });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/portal/documentos/:id/archivos
   * El propio voluntario/tutor sube un documento de su expediente.
   */
  async subirArchivo(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo (campo "archivo").' });

      const documento = await DocumentoModel.obtenerPorId(req.params.id);
      if (!documento) {
        require('fs').unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Documento no encontrado.' });
      }

      // Verificación de propiedad: el documento debe pertenecer al expediente de ESTE voluntario del portal.
      const { rows } = await query(`SELECT voluntario_id FROM expedientes WHERE id = $1`, [documento.expediente_id]);
      if (rows[0]?.voluntario_id !== req.portalVoluntarioId) {
        require('fs').unlink(req.file.path, () => {});
        return res.status(403).json({ error: 'Este documento no pertenece a tu expediente.' });
      }

      const referencia = await guardarArchivo({
        rutaLocal: req.file.path,
        ruta: `documentos/${documento.id}/portal-${req.file.filename}`,
        contentType: req.file.mimetype,
      });
      if (almacenamientoRemoto) require('fs').unlink(req.file.path, () => {});
      const archivo = await ArchivoModel.crear({
        documentoId: documento.id,
        url: referencia,
        nombreOriginal: req.file.originalname,
        mimeType: req.file.mimetype,
        tamanoBytes: req.file.size,
        subidoPor: null, // cargado por el propio voluntario/tutor, no por un usuario del sistema
      });
      await DocumentoModel.marcarCargado(documento.id);
      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);

      return res.status(201).json({ archivo, expediente });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = PortalController;
