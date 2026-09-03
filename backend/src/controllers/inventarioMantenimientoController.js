const InventarioMantenimientoModel = require('../models/inventarioMantenimientoModel');
const InventarioModel = require('../models/inventarioModel');

const InventarioMantenimientoController = {
  async listar(req, res, next) {
    try {
      const articulo = await InventarioModel.obtenerPorId(req.params.articuloId, req.usuario.asociacionId);
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado.' });
      return res.json({ mantenimientos: await InventarioMantenimientoModel.listarPorArticulo(req.params.articuloId) });
    } catch (err) { return next(err); }
  },
  async crear(req, res, next) {
    try {
      if (!req.body.tipo) return res.status(400).json({ error: 'El tipo de mantenimiento es obligatorio.' });
      const articulo = await InventarioModel.obtenerPorId(req.params.articuloId, req.usuario.asociacionId);
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado.' });
      const mantenimiento = await InventarioMantenimientoModel.crear({
        articuloId: req.params.articuloId,
        tipo: req.body.tipo,
        descripcion: req.body.descripcion,
        fecha: req.body.fecha,
        responsable: req.body.responsable,
        costo: req.body.costo,
        registradoPor: req.usuario.id,
      });
      return res.status(201).json({ mantenimiento });
    } catch (err) { return next(err); }
  },
};
module.exports = InventarioMantenimientoController;
