const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function compararPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Genera un token aleatorio (para recuperación de contraseña o refresh tokens)
 * y su hash SHA-256, que es lo que se guarda en base de datos.
 * El token "plano" es el que se envía al usuario (por correo o cookie);
 * nunca se almacena en texto plano.
 */
function generarTokenSeguro() {
  const tokenPlano = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
  return { tokenPlano, tokenHash };
}

function hashSha256(valor) {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

module.exports = { hashPassword, compararPassword, generarTokenSeguro, hashSha256 };
