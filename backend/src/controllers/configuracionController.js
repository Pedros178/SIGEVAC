const ConfiguracionModel = require('../models/configuracionModel');
const { revisarDocumentosPorVencer } = require('../jobs/vigenciaJob');

const ConfiguracionController = {
  /**
   * GET /api/configuracion
   */
  async listar(req, res, next) {
    try {
      const configuracion = await ConfiguracionModel.listar(req.usuario.asociacionId);
      return res.json({ configuracion });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * PUT /api/configuracion/:clave
   */
  async establecer(req, res, next) {
    try {
      if (req.body.valor === undefined) {
        return res.status(400).json({ error: 'El campo "valor" es obligatorio.' });
      }
      const item = await ConfiguracionModel.establecer(req.usuario.asociacionId, req.params.clave, req.body.valor);
      return res.json({ configuracion: item });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/configuracion/vigencias/revisar
   * Módulo 17 (diferenciador): dispara manualmente la revisión de
   * documentos por vencer, en vez de esperar al cron diario (útil para
   * pruebas y para forzar una revisión inmediata).
   */
  async revisarVigencias(req, res, next) {
    try {
      const resumen = await revisarDocumentosPorVencer();
      return res.json({ resultado: resumen });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ConfiguracionController;
