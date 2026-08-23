const { verificarAccessToken } = require('../utils/jwt');

/**
 * Verifica que la petición traiga un access token válido en el header
 * Authorization: Bearer <token>. Si es válido, adjunta la info del
 * usuario decodificada en req.usuario.
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado. Falta el token de acceso.' });
  }

  try {
    const payload = verificarAccessToken(token);
    req.usuario = {
      id: payload.sub,
      correo: payload.correo,
      roles: payload.roles || [],
      asociacionId: payload.asociacion_id || null,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El token de acceso ha expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token de acceso inválido.' });
  }
}

module.exports = { autenticar };
