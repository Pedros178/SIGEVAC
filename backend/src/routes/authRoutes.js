const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

// Limita intentos de login/recuperación para mitigar fuerza bruta,
// además del bloqueo por usuario que ya maneja el controlador.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', limitadorLogin, AuthController.login);
router.post('/login-2fa', limitadorLogin, AuthController.completarLogin2FA);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', limitadorLogin, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/2fa/setup', autenticar, AuthController.preparar2FA);
router.post('/2fa/enable', autenticar, AuthController.activar2FA);
router.post('/2fa/disable', autenticar, AuthController.desactivar2FA);
router.get('/me', autenticar, AuthController.me);
router.post('/asociacion-activa', autenticar, AuthController.cambiarAsociacionActiva);

module.exports = router;
