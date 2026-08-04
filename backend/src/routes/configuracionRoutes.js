const express = require('express');
const ConfiguracionController = require('../controllers/configuracionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.get('/', requierePermiso('configuracion.consultar'), ConfiguracionController.listar);
router.put('/:clave', requierePermiso('configuracion.editar'), ConfiguracionController.establecer);

module.exports = router;
