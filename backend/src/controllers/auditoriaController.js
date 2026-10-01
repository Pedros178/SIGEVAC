const AuditoriaModel = require('../models/auditoriaModel');
const BitacoraModel = require('../models/bitacoraModel');
const { aCsv } = require('../utils/exportadores');
const { leerPaginacion } = require('../utils/paginacion');
const { esUuid } = require('../utils/identificadores');

const AuditoriaController = {
  /**
   * GET /api/auditoria
   */
  async listarAuditoria(req, res, next) {
    try {
      const { modulo, usuarioId } = req.query;
      if (usuarioId !== undefined && !esUuid(usuarioId)) return res.status(400).json({ error: 'usuarioId no es un identificador válido.' });
      const { limit, offset } = leerPaginacion(req.query);
      const registros = await AuditoriaModel.listar({
        asociacionId: req.usuario.asociacionId,
        moduloAfectado: typeof modulo === 'string' ? modulo : undefined,
        usuarioId,
        limit,
        offset,
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
      const { propia, evento, formato } = req.query;
      const esExportacion = formato === 'csv';
      const registros = await BitacoraModel.listar({
        asociacionId: req.usuario.asociacionId,
        usuarioId: propia === 'true' ? req.usuario.id : undefined,
        evento: typeof evento === 'string' ? evento : undefined,
        ...(esExportacion ? { limit: leerPaginacion(req.query, { maximo: 10000 }).limit, offset: 0 } : leerPaginacion(req.query)),
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
