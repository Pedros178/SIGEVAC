const express = require('express');
const ParticipacionController = require('../controllers/participacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.delete('/:id', requierePermiso('participaciones.gestionar'), ParticipacionController.cancelar);
router.post('/:id/entrada', requierePermiso('participaciones.gestionar'), ParticipacionController.registrarEntrada);
router.post('/:id/salida', requierePermiso('participaciones.gestionar'), ParticipacionController.registrarSalida);

module.exports = router;
