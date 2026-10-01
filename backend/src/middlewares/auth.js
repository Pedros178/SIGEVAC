const { verificarAccessToken } = require('../utils/jwt');
const UsuarioModel = require('../models/usuarioModel');

/**
 * Verifica que la petición traiga un access token válido en el header
 * Authorization: Bearer <token>, y REVALIDA contra la base de datos que el
 * usuario siga activo, que pertenezca todavía a la asociación del token y
 * cuáles son sus roles actuales. Así, desactivar a un usuario o quitarle un
 * rol surte efecto de inmediato (antes el token seguía válido hasta 15 min,
 * con los roles que tenía al iniciar sesión).
 *
 * Solo se aceptan tokens de tipo 'access': los tokens del portal del
 * voluntario y los desafíos 2FA comparten secreto, pero no son sesiones.
 */
async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado. Falta el token de acceso.' });
  }

  let payload;
  try {
    payload = verificarAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El token de acceso ha expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token de acceso inválido.' });
  }

  if (payload.tipo !== 'access' || !payload.sub) {
    return res.status(401).json({ error: 'Token de acceso inválido.' });
  }

  try {
    const estado = await UsuarioModel.estadoDeSesion(payload.sub, payload.asociacion_id || null);
    if (!estado || !estado.activo || !estado.pertenece) {
      return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    req.usuario = {
      id: payload.sub,
      correo: payload.correo,
      roles: estado.roles,
      asociacionId: payload.asociacion_id || null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { autenticar };
