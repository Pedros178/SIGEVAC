const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

// Contraseñas más comunes a nivel mundial (y variantes en español) que
// cumplirían el requisito de longitud pero que son triviales de adivinar
// en un ataque de diccionario. No sustituye un chequeo contra bases de
// datos de contraseñas filtradas (p. ej. haveibeenpwned), pero bloquea el
// caso más obvio con costo cero de dependencias externas.
const PASSWORDS_COMUNES = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'contraseña', 'contrasena', 'contraseña1', 'contrasena1',
  'administrador', 'admin12345', 'bienvenido', 'bienvenido1', 'sigevac123',
  'voluntario', 'voluntario1', 'iloveyou', 'letmein123', 'welcome123',
]);

/**
 * Política de contraseñas alineada a NIST SP 800-63B: prioriza longitud
 * mínima sobre reglas de composición (mayúscula/número/símbolo obligatorios),
 * que en la práctica llevan a patrones predecibles ("Passw0rd!") sin
 * aportar entropía real. Se complementa con un límite superior (defensa
 * contra DoS por hashing de strings absurdamente largas) y un blocklist de
 * las contraseñas más triviales.
 *
 * Devuelve `null` si la contraseña es aceptable, o un mensaje de error
 * (en español, listo para responder al usuario) si no lo es.
 */
function validarFortalezaPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password.length > 128) {
    return 'La contraseña no puede tener más de 128 caracteres.';
  }
  if (PASSWORDS_COMUNES.has(password.toLowerCase())) {
    return 'Esa contraseña es demasiado común. Elige una diferente.';
  }
  return null;
}

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

module.exports = { hashPassword, compararPassword, generarTokenSeguro, hashSha256, validarFortalezaPassword };
