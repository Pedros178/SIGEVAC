const express = require('express');
const CatalogoController = require('../controllers/catalogoController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

// Administración (los catálogos son globales a la instalación, como `tipos_documento`).
// Se declaran antes de la ruta pública `/:tipo` para que `GET /` no sea tratado como un tipo.
router.get('/', autenticar, requierePermiso('configuracion.consultar'), CatalogoController.listarTodos);
router.post('/', autenticar, requierePermiso('configuracion.editar'), CatalogoController.crear);
router.put('/:id', autenticar, requierePermiso('configuracion.editar'), CatalogoController.actualizar);
router.delete('/:id', autenticar, requierePermiso('configuracion.editar'), CatalogoController.eliminar);

// Público, solo lectura: opciones de un catálogo para los selects.
router.get('/:tipo', CatalogoController.listarPorTipo);

module.exports = router;
