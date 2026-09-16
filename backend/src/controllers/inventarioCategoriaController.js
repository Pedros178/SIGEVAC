const InventarioCategoriaModel = require('../models/inventarioCategoriaModel');

const InventarioCategoriaController = {
  async listar(req, res, next) {
    try {
      return res.json({ categorias: await InventarioCategoriaModel.listarArbol(req.usuario.asociacionId) });
    } catch (err) { return next(err); }
  },
  async crear(req, res, next) {
    try {
      if (!req.body.nombre) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
      if (req.body.categoria_padre_id) {
        const padre = await InventarioCategoriaModel.obtenerPorId(req.body.categoria_padre_id, req.usuario.asociacionId);
        if (!padre) return res.status(400).json({ error: 'La categoría padre indicada no existe.' });
        if (padre.categoria_padre_id) return res.status(400).json({ error: 'Solo se admiten dos niveles: categoría y subcategoría.' });
      }
      const categoria = await InventarioCategoriaModel.crear({
        asociacionId: req.usuario.asociacionId,
        nombre: req.body.nombre,
        categoriaPadreId: req.body.categoria_padre_id,
      });
      return res.status(201).json({ categoria });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ error: 'Ya existe una categoría con ese nombre en esta área.' });
      return next(err);
    }
  },
  async actualizar(req, res, next) {
    try {
      const categoria = await InventarioCategoriaModel.actualizar(req.params.id, req.usuario.asociacionId, {
        nombre: req.body.nombre,
        activo: req.body.activo,
      });
      if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada.' });
      return res.json({ categoria });
    } catch (err) { return next(err); }
  },
};
module.exports = InventarioCategoriaController;
