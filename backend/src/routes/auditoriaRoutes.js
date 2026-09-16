const express = require('express');
const AuditoriaController = require('../controllers/auditoriaController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);
router.use(requierePermiso('auditoria.consultar'));

router.get('/', AuditoriaController.listarAuditoria);
router.get('/bitacora', AuditoriaController.listarBitacora);

module.exports = router;
