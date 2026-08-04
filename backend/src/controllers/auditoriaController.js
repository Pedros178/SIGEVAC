const AuditoriaModel = require('../models/auditoriaModel');
const BitacoraModel = require('../models/bitacoraModel');

const AuditoriaController = {
  /**
   * GET /api/auditoria
   */
  async listarAuditoria(req, res, next) {
    try {
      const { modulo, usuarioId, limit = 50, offset = 0 } = req.query;
      const registros = await AuditoriaModel.listar({
        asociacionId: req.usuario.asociacionId,
        moduloAfectado: modulo,
        usuarioId,
        limit: Number(limit),
        offset: Number(offset),
      });
      return res.json({ auditoria: registros });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/auditoria/bitacora
   */
  async listarBitacora(req, res, next) {
    try {
      const { propia, limit = 50, offset = 0 } = req.query;
      const registros = await BitacoraModel.listar({
        usuarioId: propia === 'true' ? req.usuario.id : undefined,
        limit: Number(limit),
        offset: Number(offset),
      });
      return res.json({ bitacora: registros });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AuditoriaController;
