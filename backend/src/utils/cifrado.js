const crypto = require('crypto');

const PREFIJO = 'enc:v1:';

/**
 * Cifrado simétrico (AES-256-GCM) para secretos que deben poder recuperarse
 * en claro (p. ej. el secreto TOTP de 2FA): a diferencia de una contraseña,
 * no se pueden guardar con hash porque hay que recalcular el código.
 *
 * La llave sale de TWO_FACTOR_ENC_KEY; si no está definida se deriva de
 * JWT_SECRET (suficiente para no dejar secretos en claro en la BD, pero
 * rotar JWT_SECRET sin esa variable invalidaría los 2FA ya configurados —
 * por eso en producción conviene fijar TWO_FACTOR_ENC_KEY aparte).
 */
function obtenerLlave() {
  const base = process.env.TWO_FACTOR_ENC_KEY || `2fa-derivada:${process.env.JWT_SECRET || ''}`;
  return crypto.createHash('sha256').update(base).digest();
}

function cifrar(textoPlano) {
  if (textoPlano === null || textoPlano === undefined) return textoPlano;
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', obtenerLlave(), iv);
  const cifrado = Buffer.concat([cifrador.update(String(textoPlano), 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return `${PREFIJO}${Buffer.concat([iv, etiqueta, cifrado]).toString('base64')}`;
}

/** Descifra; si el valor no tiene el prefijo (dato heredado en claro) lo devuelve tal cual. */
function descifrar(valor) {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIJO)) return valor;
  const datos = Buffer.from(valor.slice(PREFIJO.length), 'base64');
  const iv = datos.subarray(0, 12);
  const etiqueta = datos.subarray(12, 28);
  const cifrado = datos.subarray(28);
  const descifrador = crypto.createDecipheriv('aes-256-gcm', obtenerLlave(), iv);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
}

module.exports = { cifrar, descifrar, PREFIJO };
