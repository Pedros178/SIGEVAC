const jwt = require('jsonwebtoken');
require('dotenv').config();

function generarAccessToken(usuario) {
  return jwt.sign(
    {
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
    { sub: usuario.id },
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

module.exports = {
  generarAccessToken,
  generarRefreshToken,
  verificarAccessToken,
  verificarRefreshToken,
};
