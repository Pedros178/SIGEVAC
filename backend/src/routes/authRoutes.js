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
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', limitadorLogin, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.get('/me', autenticar, AuthController.me);

module.exports = router;
