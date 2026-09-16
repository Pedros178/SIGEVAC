const express = require('express');
const ParticipacionController = require('../controllers/participacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { participacionDeAsociacion } = require('../middlewares/aislamiento');

const router = express.Router();

router.use(autenticar);

router.delete('/:id', requierePermiso('participaciones.gestionar'), participacionDeAsociacion(), ParticipacionController.cancelar);
router.post('/:id/entrada', requierePermiso('participaciones.gestionar'), participacionDeAsociacion(), ParticipacionController.registrarEntrada);
router.post('/:id/salida', requierePermiso('participaciones.gestionar'), participacionDeAsociacion(), ParticipacionController.registrarSalida);

module.exports = router;
