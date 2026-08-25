const express = require('express');
const AsociacionController = require('../controllers/asociacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso, requiereRol } = require('../middlewares/permisos');

const router = express.Router();

// Sin autenticación, a propósito: la usa el formulario público de solicitud de voluntariado.
router.get('/publicas', AsociacionController.listarPublicas);

router.use(autenticar);

router.get('/', requierePermiso('asociacion.consultar'), AsociacionController.obtenerActual);
router.put('/', requierePermiso('asociacion.editar'), AsociacionController.actualizar);
router.get('/todas', requiereRol('super_admin'), AsociacionController.listarTodas);
router.post('/', requiereRol('super_admin'), AsociacionController.crear);

module.exports = router;
