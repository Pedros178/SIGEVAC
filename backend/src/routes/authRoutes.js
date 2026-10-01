const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { autenticar } = require('../middlewares/auth');
const { verificarOrigen } = require('../middlewares/verificarOrigen');

const router = express.Router();

// Limita intentos de login/recuperación para mitigar fuerza bruta,
// además del bloqueo por usuario que ya maneja el controlador.
// Un limitador INDEPENDIENTE por endpoint: antes compartían un solo contador,
// de modo que quien agotara los intentos de /forgot-password bloqueaba
// también /login (y viceversa). El límite es configurable por entorno.
// Nota: usa memoria del proceso; con varias instancias detrás de un balanceador
// cada una cuenta por separado (ver DEPLOY.md para un almacén compartido).
const MAX_INTENTOS_IP = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20', 10);
const crearLimitador = (max = MAX_INTENTOS_IP) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', crearLimitador(), AuthController.login);
router.post('/login-2fa', crearLimitador(), AuthController.completarLogin2FA);
router.post('/refresh', verificarOrigen, AuthController.refresh);
router.post('/logout', verificarOrigen, AuthController.logout);
router.post('/forgot-password', crearLimitador(), AuthController.forgotPassword);
router.post('/reset-password', crearLimitador(), AuthController.resetPassword);
router.post('/2fa/setup', autenticar, AuthController.preparar2FA);
router.post('/2fa/enable', autenticar, AuthController.activar2FA);
router.post('/2fa/disable', autenticar, AuthController.desactivar2FA);
router.get('/me', autenticar, AuthController.me);
router.post('/change-password', autenticar, crearLimitador(), AuthController.cambiarPassword);
router.post('/asociacion-activa', autenticar, AuthController.cambiarAsociacionActiva);

module.exports = router;
