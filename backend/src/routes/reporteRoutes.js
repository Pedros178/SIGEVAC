const express = require('express');
const ReporteController = require('../controllers/reporteController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);
router.use(requierePermiso('reportes.consultar'));

router.get('/tipos', ReporteController.listarTipos);
router.get('/:tipo', ReporteController.generar);

module.exports = router;
