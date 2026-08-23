const AuditoriaModel = require('../models/auditoriaModel');
const BitacoraModel = require('../models/bitacoraModel');
const { aCsv } = require('../utils/exportadores');

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
      const { propia, evento, formato, limit = 50, offset = 0 } = req.query;
      const esExportacion = formato === 'csv';
      const registros = await BitacoraModel.listar({
        usuarioId: propia === 'true' ? req.usuario.id : undefined,
        evento,
        limit: Math.min(Math.max(Number(limit) || 50, 1), esExportacion ? 10000 : 200),
        offset: esExportacion ? 0 : Math.max(Number(offset) || 0, 0),
      });
      if (esExportacion) {
        const csv = aCsv({
          columnas: [
            { key: 'evento', label: 'Evento' },
            { key: 'usuario_id', label: 'Usuario' },
            { key: 'status', label: 'Estado' },
            { key: 'duracion_ms', label: 'Duración (ms)' },
            { key: 'creado_en', label: 'Fecha' },
          ],
          filas: registros.map((registro) => ({
            evento: registro.evento,
            usuario_id: registro.usuario_id || '',
            status: registro.contexto?.status || '',
            duracion_ms: registro.contexto?.duracion_ms ?? '',
            creado_en: registro.creado_en,
          })),
        });
        res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="sigevac-bitacora.csv"' });
        return res.send(csv);
      }
      return res.json({ bitacora: registros });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AuditoriaController;
