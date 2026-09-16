const InventarioModel = require('../models/inventarioModel');
const QRCode = require('qrcode');

const InventarioController = {
  async listar(req, res, next) {
    try {
      const { categoria_id: categoriaId, subcategoria_id: subcategoriaId, q: busqueda } = req.query;
      const articulos = await InventarioModel.listar(req.usuario.asociacionId, { categoriaId, subcategoriaId, busqueda });
      return res.json({ articulos });
    } catch (err) { return next(err); }
  },
  async obtener(req, res, next) {
    try {
      const articulo = await InventarioModel.obtenerPorId(req.params.id, req.usuario.asociacionId);
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado.' });
      return res.json({ articulo });
    } catch (err) { return next(err); }
  },
  async obtenerPorQR(req, res, next) {
    try {
      const articulo = await InventarioModel.obtenerPorQR(req.params.codigo, req.usuario.asociacionId);
      if (!articulo) return res.status(404).json({ error: 'No se encontró ningún artículo con ese código QR.' });
      return res.json({ articulo });
    } catch (err) { return next(err); }
  },
  async obtenerImagenQR(req, res, next) {
    try {
      const articulo = await InventarioModel.obtenerPorId(req.params.id, req.usuario.asociacionId);
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado.' });
      const imagen = await QRCode.toBuffer(articulo.codigo_qr, { type: 'png', width: 320, margin: 2 });
      res.type('png').send(imagen);
    } catch (err) { return next(err); }
  },
  async crear(req, res, next) {
    try {
      if (!req.body.nombre) return res.status(400).json({ error: 'El nombre del artículo es obligatorio.' });
      const articulo = await InventarioModel.crear({
        asociacionId: req.usuario.asociacionId,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        unidad: req.body.unidad,
        minimo: req.body.minimo,
        categoriaId: req.body.categoria_id,
        subcategoriaId: req.body.subcategoria_id,
        estadoFisico: req.body.estado_fisico,
        ubicacion: req.body.ubicacion,
        esPrestable: req.body.es_prestable,
      });
      return res.status(201).json({ articulo });
    } catch (err) { return next(err); }
  },
  async actualizar(req, res, next) {
    try {
      const articulo = await InventarioModel.actualizar(req.params.id, req.usuario.asociacionId, {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        unidad: req.body.unidad,
        minimo: req.body.minimo,
        categoriaId: req.body.categoria_id,
        subcategoriaId: req.body.subcategoria_id,
        estadoFisico: req.body.estado_fisico,
        ubicacion: req.body.ubicacion,
        esPrestable: typeof req.body.es_prestable === 'boolean' ? req.body.es_prestable : undefined,
      });
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado.' });
      return res.json({ articulo });
    } catch (err) { return next(err); }
  },
  async movimiento(req, res, next) {
    try {
      const cantidad = Number(req.body.cantidad);
      if (!['entrada', 'salida'].includes(req.body.tipo) || !Number.isInteger(cantidad) || cantidad < 1) return res.status(400).json({ error: 'tipo y cantidad válida son obligatorios.' });
      return res.status(201).json({ movimiento: await InventarioModel.movimiento({ ...req.body, cantidad, usuarioId: req.usuario.id, asociacionId: req.usuario.asociacionId }) });
    } catch (err) { return next(err); }
  },
  async subirFoto(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "foto").' });
      const { almacenamientoRemoto, guardarArchivo } = require('../config/storage');
      const articulo = await InventarioModel.obtenerPorId(req.params.id, req.usuario.asociacionId);
      if (!articulo) {
        require('fs').unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Artículo no encontrado.' });
      }
      const referencia = await guardarArchivo({
        rutaLocal: req.file.path,
        ruta: `inventario/${articulo.id}/foto-${req.file.filename}`,
        contentType: req.file.mimetype,
      });
      if (almacenamientoRemoto) require('fs').unlink(req.file.path, () => {});
      const foto = await InventarioModel.agregarFoto({
        articuloId: articulo.id,
        url: referencia,
        nombreOriginal: req.file.originalname,
        mimeType: req.file.mimetype,
        subidoPor: req.usuario.id,
        esPrincipal: req.body.es_principal === 'true' || (articulo.fotos || []).length === 0,
      });
      return res.status(201).json({ foto });
    } catch (err) { return next(err); }
  },
  async obtenerFoto(req, res, next) {
    try {
      const { obtenerArchivo } = require('../config/storage');
      const foto = await InventarioModel.obtenerFotoPorId(req.params.fotoId);
      if (!foto) return res.status(404).json({ error: 'Foto no encontrada.' });
      try {
        const contenido = await obtenerArchivo(foto.url);
        res.set('Content-Type', foto.mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'private, max-age=3600');
        return res.send(contenido);
      } catch {
        return res.status(404).json({ error: 'La foto ya no existe en el almacenamiento.' });
      }
    } catch (err) { return next(err); }
  },
  async eliminarFoto(req, res, next) {
    try {
      const foto = await InventarioModel.eliminarFoto(req.params.fotoId, req.params.id);
      if (!foto) return res.status(404).json({ error: 'Foto no encontrada.' });
      return res.json({ mensaje: 'Foto eliminada.' });
    } catch (err) { return next(err); }
  },
};
module.exports = InventarioController;
