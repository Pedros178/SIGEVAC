const express = require('express');
const AsociacionController = require('../controllers/asociacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso, requiereRol } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.get('/', requierePermiso('asociacion.consultar'), AsociacionController.obtenerActual);
router.put('/', requierePermiso('asociacion.editar'), AsociacionController.actualizar);
router.get('/todas', requiereRol('super_admin'), AsociacionController.listarTodas);

module.exports = router;
