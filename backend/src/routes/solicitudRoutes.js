const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/solicitudController');
const { autenticar } = require('../middlewares/auth');
const { requiereRol } = require('../middlewares/permisos');
const router = express.Router();

// Endpoint público (sin autenticación): cualquier persona puede solicitar
// unirse como voluntario. Sin límite de tasa, podría usarse para llenar la
// tabla de solicitudes con spam automatizado.
const limitadorSolicitud = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas solicitudes desde esta red. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limitadorSolicitud, controller.crear);
router.use(autenticar, requiereRol('super_admin'));
router.get('/', controller.listar);
router.patch('/:id/estado', controller.actualizarEstado);
module.exports = router;
