const express = require('express');
const CredencialController = require('../controllers/credencialController');
const PaginaPublicaController = require('../controllers/paginaPublicaController');
const GaleriaController = require('../controllers/galeriaController');
const PrivacidadController = require('../controllers/privacidadController');
const { limitadorPublico } = require('../middlewares/limitadores');

const router = express.Router();

// Endpoints sin sesión: límite más estricto que el general (ver middlewares/limitadores.js).
router.use(limitadorPublico());

router.get('/certificados/:codigo.pdf', CredencialController.certificadoPdf);
router.get('/certificados/:codigo', CredencialController.certificadoPublico);
router.get('/actividades', PaginaPublicaController.actividadesProximas);
router.get('/estadisticas', PaginaPublicaController.estadisticas);
router.get('/aviso-privacidad', PrivacidadController.avisoPublico);
router.get('/galeria', GaleriaController.listarPublica);
// Estas imágenes se muestran en la página pública (otro origen que la API): helmet
// pone Cross-Origin-Resource-Policy: same-origin por defecto, lo que haría que el
// navegador las bloqueara. Solo en esta ruta (imágenes ya publicadas) se abre.
router.get('/galeria/:id/imagen', (req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, GaleriaController.imagenPublica);

module.exports = router;