const ConfigDocumentosModel = require('../models/configDocumentosModel');

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APLICA_A = ['mayor', 'menor', 'ambos'];

const DocumentosRequeridosController = {
  /** GET /api/configuracion/documentos-requeridos */
  async listar(req, res, next) {
    try {
      const documentos = await ConfigDocumentosModel.listarEfectivo(req.usuario.asociacionId);
      return res.json({ documentos });
    } catch (err) { return next(err); }
  },

  /**
   * PUT /api/configuracion/documentos-requeridos/:tipoDocumentoId
   * Body: { obligatorio?: boolean, aplica_a?: 'mayor' | 'menor' | 'ambos' }
   * Aplica a los expedientes que se creen DESPUÉS del cambio.
   */
  async establecer(req, res, next) {
    try {
      const { tipoDocumentoId } = req.params;
      if (!PATRON_UUID.test(tipoDocumentoId)) return res.status(404).json({ error: 'Tipo de documento no encontrado.' });

      const obligatorio = req.body.obligatorio;
      const aplicaA = req.body.aplica_a ?? req.body.aplicaA;
      if (obligatorio === undefined && aplicaA === undefined) {
        return res.status(400).json({ error: 'Envía obligatorio (booleano) y/o aplica_a (mayor, menor o ambos).' });
      }
      if (obligatorio !== undefined && typeof obligatorio !== 'boolean') {
        return res.status(400).json({ error: 'obligatorio debe ser true o false.' });
      }
      if (aplicaA !== undefined && !APLICA_A.includes(aplicaA)) {
        return res.status(400).json({ error: 'aplica_a debe ser mayor, menor o ambos.' });
      }

      const config = await ConfigDocumentosModel.establecer(req.usuario.asociacionId, tipoDocumentoId, { obligatorio, aplicaA });
      if (!config) return res.status(404).json({ error: 'Tipo de documento no encontrado.' });
      return res.json({ configuracion: config });
    } catch (err) { return next(err); }
  },

  /** DELETE /api/configuracion/documentos-requeridos/:tipoDocumentoId — vuelve al valor predeterminado. */
  async restablecer(req, res, next) {
    try {
      const { tipoDocumentoId } = req.params;
      if (!PATRON_UUID.test(tipoDocumentoId)) return res.status(404).json({ error: 'Tipo de documento no encontrado.' });
      await ConfigDocumentosModel.restablecer(req.usuario.asociacionId, tipoDocumentoId);
      return res.json({ mensaje: 'Se restableció el valor predeterminado.' });
    } catch (err) { return next(err); }
  },
};

module.exports = DocumentosRequeridosController;
