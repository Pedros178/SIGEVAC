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
