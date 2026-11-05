const { verificarTokenPortal } = require('../utils/jwt');
const { query } = require('../config/database');

/**
 * Autentica al voluntario/tutor en el Portal usando el token de "enlace
 * mágico" (no es una sesión de usuario del sistema, es de solo su propio
 * expediente). Adjunta req.portalVoluntarioId.
 */
async function autenticarPortal(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Acceso al portal no autenticado.' });
  }

  let payload;
  try {
    payload = verificarTokenPortal(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Tu enlace de acceso ha expirado. Solicita uno nuevo.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Enlace de acceso inválido.' });
  }

  try {
    // El enlace es un JWT sin estado: si el voluntario fue anonimizado (derecho de cancelación) o ya no existe,
    // un enlace aún vigente (hasta 24 h) no debe seguir dando acceso.
    const { rows } = await query('SELECT 1 FROM voluntarios WHERE id = $1 AND anonimizado_en IS NULL', [payload.voluntarioId]);
    if (!rows[0]) return res.status(401).json({ error: 'Enlace de acceso inválido.' });
    req.portalVoluntarioId = payload.voluntarioId;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { autenticarPortal };
