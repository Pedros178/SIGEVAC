const crypto = require('crypto');

/**
 * Cifrado de campos con datos personales SENSIBLES en la base de datos
 * (AES-256-GCM, llave dedicada DATA_ENC_KEY, independiente de la del 2FA).
 *
 * Por qué: la LFPDPPP considera datos sensibles los de salud (tipo de sangre,
 * alergias, discapacidad, enfermedades crónicas). Con este cifrado, un
 * respaldo filtrado, una consulta directa a la BD o un acceso indebido al
 * panel de Supabase NO exponen esos datos en claro: hace falta además la
 * llave, que vive solo en las variables de entorno del servidor.
 *
 * Formato: `encd:v1:` + base64(iv[12] | etiqueta[16] | cifrado). Cada valor
 * usa un IV aleatorio, así que dos valores iguales producen textos distintos
 * (por eso estos campos no sirven para búsquedas por igualdad: no se buscan).
 *
 * Producción exige DATA_ENC_KEY (ver validarEntorno.js). En desarrollo y
 * pruebas, si falta, se deriva de JWT_SECRET para no estorbar.
 */
const PREFIJO = 'encd:v1:';

function obtenerLlave() {
  const base = process.env.DATA_ENC_KEY || `datos-derivada:${process.env.JWT_SECRET || ''}`;
  return crypto.createHash('sha256').update(base).digest();
}

function estaCifrado(valor) {
  return typeof valor === 'string' && valor.startsWith(PREFIJO);
}

/** Cifra un valor de texto. null/undefined/'' se devuelven tal cual; un valor ya cifrado no se vuelve a cifrar. */
function cifrarDato(valor) {
  if (valor === null || valor === undefined || valor === '') return valor;
  if (estaCifrado(valor)) return valor;
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', obtenerLlave(), iv);
  const cifrado = Buffer.concat([cifrador.update(String(valor), 'utf8'), cifrador.final()]);
  return `${PREFIJO}${Buffer.concat([iv, cifrador.getAuthTag(), cifrado]).toString('base64')}`;
}

/** Descifra; un valor sin prefijo (dato heredado en claro) se devuelve tal cual. Lanza si la llave no coincide o el dato fue alterado. */
function descifrarDato(valor) {
  if (!estaCifrado(valor)) return valor;
  const datos = Buffer.from(valor.slice(PREFIJO.length), 'base64');
  const descifrador = crypto.createDecipheriv('aes-256-gcm', obtenerLlave(), datos.subarray(0, 12));
  descifrador.setAuthTag(datos.subarray(12, 28));
  return Buffer.concat([descifrador.update(datos.subarray(28)), descifrador.final()]).toString('utf8');
}

/** Columnas de `voluntarios` cifradas en reposo (datos sensibles de salud). */
const COLUMNAS_SENSIBLES_VOLUNTARIO = ['tipo_sangre', 'alergias', 'discapacidad', 'enfermedad_cronica'];

/** Devuelve una copia de la fila con las columnas sensibles descifradas. */
function revelarFila(fila, columnas = COLUMNAS_SENSIBLES_VOLUNTARIO) {
  if (!fila) return fila;
  const copia = { ...fila };
  for (const col of columnas) {
    if (col in copia) copia[col] = descifrarDato(copia[col]);
  }
  return copia;
}

module.exports = {
  PREFIJO, cifrarDato, descifrarDato, estaCifrado, revelarFila, COLUMNAS_SENSIBLES_VOLUNTARIO, obtenerLlave,
};
