const express = require('express');
const CredencialController = require('../controllers/credencialController');
const PaginaPublicaController = require('../controllers/paginaPublicaController');
const GaleriaController = require('../controllers/galeriaController');

const router = express.Router();

router.get('/certificados/:codigo.pdf', CredencialController.certificadoPdf);
router.get('/certificados/:codigo', CredencialController.certificadoPublico);
router.get('/actividades', PaginaPublicaController.actividadesProximas);
router.get('/estadisticas', PaginaPublicaController.estadisticas);
router.get('/galeria', GaleriaController.listarPublica);
router.get('/galeria/:id/imagen', GaleriaController.imagenPublica);

module.exports = router;