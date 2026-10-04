const { fechaValida } = require('../utils/edad');
const { esUuid } = require('../utils/identificadores');
const InventarioPrestamoModel = require('../models/inventarioPrestamoModel');

const InventarioPrestamoController = {
  async listar(req, res, next) {
    try {
      const { estado } = req.query;
      return res.json({ prestamos: await InventarioPrestamoModel.listar(req.usuario.asociacionId, { estado }) });
    } catch (err) { return next(err); }
  },
  async crear(req, res, next) {
    try {
      const cantidad = Number(req.body.cantidad);
      const { responsable, fecha_devolucion_programada: fechaDevolucionProgramada } = req.body;
      if (!req.body.articulo_id || !responsable || !fechaDevolucionProgramada || !Number.isInteger(cantidad) || cantidad < 1) {
        return res.status(400).json({ error: 'articulo_id, responsable, cantidad válida y fecha_devolucion_programada son obligatorios.' });
      }
      if (typeof responsable !== 'string' || responsable.length > 150) return res.status(400).json({ error: 'responsable debe ser texto de hasta 150 caracteres.' });
      if (cantidad > 1_000_000) return res.status(400).json({ error: 'La cantidad excede el máximo permitido.' });
      if (!fechaValida(fechaDevolucionProgramada)) return res.status(400).json({ error: 'fecha_devolucion_programada no es una fecha válida (AAAA-MM-DD).' });
      if (String(fechaDevolucionProgramada).slice(0, 10) < new Date().toLocaleDateString('en-CA')) {
        return res.status(400).json({ error: 'La fecha de devolución no puede ser anterior a hoy.' });
      }
      for (const campo of ['articulo_id', 'voluntario_id', 'actividad_id']) {
        if (req.body[campo] && !esUuid(req.body[campo])) return res.status(400).json({ error: `${campo} no es un identificador válido.` });
      }
      const prestamo = await InventarioPrestamoModel.crear({
        asociacionId: req.usuario.asociacionId,
        articuloId: req.body.articulo_id,
        cantidad,
        responsable,
        contacto: req.body.contacto,
        motivo: req.body.motivo,
        fechaDevolucionProgramada,
        condicionEntrega: req.body.condicion_entrega,
        registradoPor: req.usuario.id,
        voluntarioId: req.body.voluntario_id,
        actividadId: req.body.actividad_id,
      });
      return res.status(201).json({ prestamo });
    } catch (err) { return next(err); }
  },
  async devolver(req, res, next) {
    try {
      const prestamo = await InventarioPrestamoModel.devolver({
        id: req.params.id,
        asociacionId: req.usuario.asociacionId,
        condicionRetorno: req.body.condicion_retorno,
        estadoFisicoResultante: req.body.estado_fisico_resultante,
      });
      return res.json({ prestamo });
    } catch (err) { return next(err); }
  },
};
module.exports = InventarioPrestamoController;
