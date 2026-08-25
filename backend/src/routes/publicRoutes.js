const express = require('express');
const CredencialController = require('../controllers/credencialController');

const router = express.Router();

router.get('/certificados/:codigo.pdf', CredencialController.certificadoPdf);
router.get('/certificados/:codigo', CredencialController.certificadoPublico);

module.exports = router;