const express = require('express');
const RespaldoController = require('../controllers/respaldoController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);
router.use(requierePermiso('respaldos.gestionar'));

router.get('/', RespaldoController.listar);
router.post('/', RespaldoController.generar);
router.get('/:id/descargar', RespaldoController.descargar);

module.exports = router;
