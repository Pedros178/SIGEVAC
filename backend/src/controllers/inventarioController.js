const InventarioModel = require('../models/inventarioModel');

const InventarioController = {
  async listar(req, res, next) { try { return res.json({ articulos: await InventarioModel.listar(req.usuario.asociacionId) }); } catch (err) { return next(err); } },
  async crear(req, res, next) {
    try {
      if (!req.body.nombre) return res.status(400).json({ error: 'El nombre del artículo es obligatorio.' });
      return res.status(201).json({ articulo: await InventarioModel.crear({ ...req.body, asociacionId: req.usuario.asociacionId }) });
    } catch (err) { return next(err); }
  },
  async movimiento(req, res, next) {
    try {
      const cantidad = Number(req.body.cantidad);
      if (!['entrada', 'salida'].includes(req.body.tipo) || !Number.isInteger(cantidad) || cantidad < 1) return res.status(400).json({ error: 'tipo y cantidad válida son obligatorios.' });
      return res.status(201).json({ movimiento: await InventarioModel.movimiento({ ...req.body, cantidad, usuarioId: req.usuario.id }) });
    } catch (err) { return next(err); }
  },
};
module.exports = InventarioController;
