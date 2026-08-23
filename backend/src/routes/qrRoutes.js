const express = require('express');
const CredencialController = require('../controllers/credencialController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

// Escaneo de credencial: valida identidad del voluntario dueño del código
router.get('/:codigo', requierePermiso('participaciones.gestionar'), CredencialController.validarPorCodigo);
router.post('/:codigo/asistencia', requierePermiso('participaciones.gestionar'), CredencialController.registrarAsistenciaPorCodigo);

module.exports = router;
