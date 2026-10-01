const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function generarAccessToken(usuario) {
  return jwt.sign(
    {
      tipo: 'access',
      sub: usuario.id,
      correo: usuario.correo,
      roles: usuario.roles || [],
      asociacion_id: usuario.asociacion_id || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generarRefreshToken(usuario) {
  return jwt.sign(
    // jti: dos refresh emitidos en el mismo segundo para el mismo usuario
    // serían idénticos (mismo hash en BD) sin un identificador único.
    { sub: usuario.id, asociacion_id: usuario.asociacion_id || null, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

function verificarAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verificarRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Token del Portal del Voluntario/Tutor (Fase 6, diferenciador). Usa el mismo
 * secreto que el access token pero con tipo='portal' y vida más larga (24h),
 * ya que se distribuye por correo como "enlace mágico" en vez de login con
 * contraseña.
 */
function generarTokenPortal(voluntarioId) {
  return jwt.sign({ tipo: 'portal', voluntarioId }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

function verificarTokenPortal(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.tipo !== 'portal') throw new Error('Token no es de tipo portal.');
  return payload;
}

function generarToken2FA(usuarioId) {
  return jwt.sign({ tipo: '2fa', usuarioId }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function verificarToken2FA(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.tipo !== '2fa') throw new Error('Token no es de tipo 2FA.');
  return payload;
}

module.exports = {
  generarAccessToken,
  generarRefreshToken,
  verificarAccessToken,
  verificarRefreshToken,
  generarTokenPortal,
  verificarTokenPortal,
  generarToken2FA,
  verificarToken2FA,
};
