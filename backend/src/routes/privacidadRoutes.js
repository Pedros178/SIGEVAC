const express = require('express');
const PrivacidadController = require('../controllers/privacidadController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { voluntarioDeAsociacion } = require('../middlewares/aislamiento');

const router = express.Router();

// Derechos ARCO y protección de datos personales (LFPDPPP). Todo requiere sesión y el permiso dedicado.
router.use(autenticar, requierePermiso('privacidad.gestionar'));

router.get('/voluntarios/:id/datos-personales', voluntarioDeAsociacion(), PrivacidadController.exportarDatos);
router.get('/voluntarios/:id/consentimientos', voluntarioDeAsociacion(), PrivacidadController.listarConsentimientos);
router.post('/voluntarios/:id/consentimientos', voluntarioDeAsociacion(), PrivacidadController.registrarConsentimiento);
router.patch('/voluntarios/:id/consentimientos/:consentimientoId/revocar', voluntarioDeAsociacion(), PrivacidadController.revocarConsentimiento);
router.post('/voluntarios/:id/anonimizar', voluntarioDeAsociacion(), PrivacidadController.anonimizar);

router.get('/retencion/candidatos', PrivacidadController.candidatosARetencion);

router.get('/arco', PrivacidadController.listarSolicitudesArco);
router.post('/arco', PrivacidadController.crearSolicitudArco);
router.patch('/arco/:id', PrivacidadController.resolverSolicitudArco);
router.patch('/arco/:id/ampliar', PrivacidadController.ampliarSolicitudArco);

router.get('/aviso', PrivacidadController.obtenerAviso);
router.put('/aviso', PrivacidadController.guardarAviso);

module.exports = router;
