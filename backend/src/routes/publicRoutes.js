const express = require('express');
const CredencialController = require('../controllers/credencialController');
const PaginaPublicaController = require('../controllers/paginaPublicaController');

const router = express.Router();

router.get('/certificados/:codigo.pdf', CredencialController.certificadoPdf);
router.get('/certificados/:codigo', CredencialController.certificadoPublico);
router.get('/actividades', PaginaPublicaController.actividadesProximas);

module.exports = router;