const express = require('express');
const controller = require('../controllers/inventarioController');
const categoriaController = require('../controllers/inventarioCategoriaController');
const prestamoController = require('../controllers/inventarioPrestamoController');
const mantenimientoController = require('../controllers/inventarioMantenimientoController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { articuloDeAsociacion, prestamoDeAsociacion, fotoInventarioDeAsociacion } = require('../middlewares/aislamiento');
const { upload } = require('../config/uploads');
const { verificarContenidoArchivo } = require('../middlewares/validarArchivo');

const router = express.Router();
router.use(autenticar);

// Categorías / subcategorías
router.get('/categorias', requierePermiso('inventario.consultar'), categoriaController.listar);
router.post('/categorias', requierePermiso('inventario.gestionar'), categoriaController.crear);
router.put('/categorias/:id', requierePermiso('inventario.gestionar'), categoriaController.actualizar);

// Préstamos formales (responsable, fecha de devolución, condición de entrega/retorno)
router.get('/prestamos', requierePermiso('inventario.consultar'), prestamoController.listar);
router.post('/prestamos', requierePermiso('inventario.gestionar'), prestamoController.crear);
router.put('/prestamos/:id/devolver', requierePermiso('inventario.gestionar'), prestamoDeAsociacion(), prestamoController.devolver);

// Consulta rápida por código QR
router.get('/qr/:codigo', requierePermiso('inventario.consultar'), controller.obtenerPorQR);
router.get('/:id/qr', requierePermiso('inventario.consultar'), articuloDeAsociacion(), controller.obtenerImagenQR);

// Artículos
router.get('/', requierePermiso('inventario.consultar'), controller.listar);
router.post('/', requierePermiso('inventario.gestionar'), controller.crear);
router.get('/:id', requierePermiso('inventario.consultar'), articuloDeAsociacion(), controller.obtener);
router.put('/:id', requierePermiso('inventario.gestionar'), articuloDeAsociacion(), controller.actualizar);
router.post('/:id/movimientos', requierePermiso('inventario.gestionar'), articuloDeAsociacion(), (req, res, next) => controller.movimiento(Object.assign(req, { body: { ...req.body, articuloId: req.params.id } }), res, next));

// Fotos
router.post(
  '/:id/fotos',
  requierePermiso('inventario.gestionar'),
  articuloDeAsociacion(),
  upload.single('foto'),
  verificarContenidoArchivo,
  controller.subirFoto
);
router.get('/:id/fotos/:fotoId', requierePermiso('inventario.consultar'), articuloDeAsociacion(), fotoInventarioDeAsociacion(), controller.obtenerFoto);
router.delete('/:id/fotos/:fotoId', requierePermiso('inventario.gestionar'), articuloDeAsociacion(), fotoInventarioDeAsociacion(), controller.eliminarFoto);

// Mantenimientos por artículo
router.get('/:articuloId/mantenimientos', requierePermiso('inventario.consultar'), articuloDeAsociacion('articuloId'), mantenimientoController.listar);
router.post('/:articuloId/mantenimientos', requierePermiso('inventario.gestionar'), articuloDeAsociacion('articuloId'), mantenimientoController.crear);

module.exports = router;
