const express = require('express');
const rateLimit = require('express-rate-limit');
const PortalController = require('../controllers/portalController');
const { autenticarPortal } = require('../middlewares/portalAuth');
const { upload } = require('../config/uploads');

const router = express.Router();

const limitadorSolicitud = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas solicitudes de acceso. Intenta de nuevo más tarde.' },
});

router.post('/solicitar-acceso', limitadorSolicitud, PortalController.solicitarAcceso);
router.get('/expediente', autenticarPortal, PortalController.obtenerExpediente);
router.post('/documentos/:id/archivos', autenticarPortal, upload.single('archivo'), PortalController.subirArchivo);

module.exports = router;
