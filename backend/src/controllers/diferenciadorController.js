const crypto = require('crypto');
const { ExpedienteModel, DocumentoModel } = require('../models/expedienteModel');
const VoluntarioModel = require('../models/voluntarioModel');
const TutorModel = require('../models/tutorModel');
const AsociacionModel = require('../models/asociacionModel');
const ArchivoModel = require('../models/archivoModel');
const FirmaModel = require('../models/firmaModel');
const { generarPdfPlantilla, TIPOS_CON_PLANTILLA } = require('../utils/plantillasDocumentos');
const { guardarArchivo } = require('../config/storage');
const { query } = require('../config/database');

const DiferenciadorController = {
  /**
   * GET /api/documentos/plantillas/disponibles
   */
  listarPlantillasDisponibles(req, res) {
    return res.json({ tipos: TIPOS_CON_PLANTILLA });
  },

  /**
   * POST /api/documentos/:id/generar
   * Genera el PDF del documento a partir de su plantilla institucional y lo
   * guarda como una nueva versión del archivo (generación automática de
   * documentos a partir de plantillas).
   */
  async generarDesdeePlantilla(req, res, next) {
    try {
      const documento = await DocumentoModel.obtenerPorId(req.params.id);
      if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

      if (!TIPOS_CON_PLANTILLA.includes(documento.tipo_clave)) {
        return res.status(400).json({
          error: `El documento "${documento.tipo_etiqueta}" no tiene una plantilla disponible.`,
          disponibles: TIPOS_CON_PLANTILLA,
        });
      }

      // Resolvemos el voluntario dueño de este documento vía su expediente.
      const { rows } = await query(`SELECT voluntario_id FROM expedientes WHERE id = $1`, [documento.expediente_id]);
      const voluntarioId = rows[0]?.voluntario_id;
      if (!voluntarioId) return res.status(404).json({ error: 'No se encontró el voluntario de este expediente.' });

      const voluntario = await VoluntarioModel.obtenerPorId(voluntarioId);
      const asociacion = await AsociacionModel.obtener(voluntario.asociacion_id);
      const tutor = voluntario.es_menor_edad ? await TutorModel.obtenerPorVoluntario(voluntarioId) : null;

      const bufferPdf = await generarPdfPlantilla(documento.tipo_clave, { voluntario, asociacion, tutor });

      const nombreArchivo = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`;
      const referencia = await guardarArchivo({
        buffer: bufferPdf,
        ruta: `documentos/${documento.id}/${nombreArchivo}`,
        contentType: 'application/pdf',
      });

      const archivo = await ArchivoModel.crear({
        documentoId: documento.id,
        url: referencia,
        nombreOriginal: `${documento.tipo_clave}.pdf`,
        mimeType: 'application/pdf',
        tamanoBytes: bufferPdf.length,
        subidoPor: req.usuario.id,
      });
      await DocumentoModel.marcarCargado(documento.id);
      const expedienteActualizado = await ExpedienteModel.recalcularEstado(documento.expediente_id);

      return res.status(201).json({ archivo, expediente: expedienteActualizado });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/documentos/:id/firmar
   * Guarda una firma electrónica simple (trazo capturado en el navegador)
   * asociada al documento. Es un acuse adicional de conformidad, no
   * reemplaza al archivo cargado.
   */
  async firmar(req, res, next) {
    try {
      const { imagenPngBase64, firmanteNombre, firmanteTipo } = req.body;
      if (!imagenPngBase64 || !imagenPngBase64.startsWith('data:image/png;base64,')) {
        return res.status(400).json({ error: 'Se requiere "imagenPngBase64" como data URL PNG válida.' });
      }
      if (!firmanteNombre) {
        return res.status(400).json({ error: 'Se requiere el nombre de quien firma.' });
      }

      const documento = await DocumentoModel.obtenerPorId(req.params.id);
      if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

      const firma = await FirmaModel.crear({
        documentoId: documento.id,
        firmanteNombre,
        firmanteTipo,
        imagenPngBase64,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await DocumentoModel.marcarCargado(documento.id);
      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);

      return res.status(201).json({ firma, expediente });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/documentos/:id/firma
   */
  async obtenerFirma(req, res, next) {
    try {
      const firma = await FirmaModel.obtenerPorDocumento(req.params.id);
      if (!firma) return res.status(404).json({ error: 'Este documento no tiene firma registrada.' });
      return res.json({ firma });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = DiferenciadorController;
