const express = require('express');
const ActividadController = require('../controllers/actividadController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { evidenciaDeAsociacion } = require('../middlewares/aislamiento');

const router = express.Router();

router.use(autenticar);

router.get('/:id', requierePermiso('actividades.consultar'), evidenciaDeAsociacion(), ActividadController.obtenerEvidencia);

module.exports = router;
