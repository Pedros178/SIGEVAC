const { verificarTokenPortal } = require('../utils/jwt');

/**
 * Autentica al voluntario/tutor en el Portal usando el token de "enlace
 * mágico" (no es una sesión de usuario del sistema, es de solo su propio
 * expediente). Adjunta req.portalVoluntarioId.
 */
function autenticarPortal(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Acceso al portal no autenticado.' });
  }

  try {
    const payload = verificarTokenPortal(token);
    req.portalVoluntarioId = payload.voluntarioId;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Tu enlace de acceso ha expirado. Solicita uno nuevo.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Enlace de acceso inválido.' });
  }
}

module.exports = { autenticarPortal };
