const { verificarAccessToken } = require('../utils/jwt');
const UsuarioModel = require('../models/usuarioModel');

const RUTAS_PERMITIDAS_SIN_CAMBIO = ['/auth/change-password', '/auth/me', '/auth/logout', '/auth/refresh'];

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
      return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión de nuevo.', code: 'SESION_INVALIDA' });
    }
    // Contraseña inicial pendiente de cambio: solo se permiten las rutas necesarias para cambiarla
    if (estado.debe_cambiar_password && !RUTAS_PERMITIDAS_SIN_CAMBIO.some((r) => req.originalUrl.split('?')[0].endsWith(r))) {
      return res.status(403).json({ error: 'Debes cambiar tu contraseña inicial antes de continuar.', code: 'PASSWORD_CAMBIO_REQUERIDO' });
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
