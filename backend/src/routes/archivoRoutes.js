const express = require('express');
const ArchivoController = require('../controllers/archivoController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.get('/:id/descargar', requierePermiso('expedientes.consultar'), ArchivoController.descargar);
router.get('/:id/visualizar', requierePermiso('expedientes.consultar'), ArchivoController.visualizar);

module.exports = router;
