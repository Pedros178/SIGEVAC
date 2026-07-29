const path = require('path');
const fs = require('fs');
const ArchivoModel = require('../models/archivoModel');
const { DocumentoModel, ExpedienteModel } = require('../models/expedienteModel');
const { UPLOADS_DIR } = require('../config/uploads');

const ArchivoController = {
  /**
   * POST /api/documentos/:documentoId/archivos
   * Sube una nueva versión del archivo para un documento (multipart/form-data, campo "archivo").
   */
  async subir(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo (campo "archivo").' });
      }

      const documento = await DocumentoModel.obtenerPorId(req.params.documentoId);
      if (!documento) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Documento no encontrado.' });
      }

      const archivo = await ArchivoModel.crear({
        documentoId: documento.id,
        url: `/uploads/${req.file.filename}`,
        nombreOriginal: req.file.originalname,
        mimeType: req.file.mimetype,
        tamanoBytes: req.file.size,
        subidoPor: req.usuario.id,
      });

      await DocumentoModel.marcarCargado(documento.id);
      const expediente = await ExpedienteModel.recalcularEstado(documento.expediente_id);

      return res.status(201).json({ archivo, expediente });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/documentos/:documentoId/archivos
   * Historial de versiones (Módulo 8).
   */
  async listarHistorial(req, res, next) {
    try {
      const archivos = await ArchivoModel.listarPorDocumento(req.params.documentoId);
      return res.json({ archivos });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/archivos/:id/descargar
   */
  async descargar(req, res, next) {
    try {
      const archivo = await ArchivoModel.obtenerPorId(req.params.id);
      if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado.' });

      const nombreArchivo = path.basename(archivo.url);
      const rutaCompleta = path.join(UPLOADS_DIR, nombreArchivo);
      if (!fs.existsSync(rutaCompleta)) {
        return res.status(404).json({ error: 'El archivo ya no existe en el almacenamiento.' });
      }

      return res.download(rutaCompleta, archivo.nombre_original);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ArchivoController;
