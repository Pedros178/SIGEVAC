const crypto = require('crypto');
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

/**
 * Cifrado de archivos grandes (respaldos de la base de datos) con AES-256-GCM en flujo,
 * sin cargar el archivo completo en memoria.
 *
 * Un respaldo SQL en claro contiene TODA la base (correos, CURP, teléfonos, hashes...).
 * Guardado así en el disco del servidor o en el bucket de Supabase, una filtración del
 * almacenamiento expone todo. Cifrado, el archivo es inservible sin DATA_ENC_KEY.
 *
 * Formato (.enc): "SGVBK1\n" (7 bytes) | IV (12) | texto cifrado | etiqueta GCM (16).
 * La llave se deriva de DATA_ENC_KEY con HKDF y un contexto propio, para que no sea la
 * misma que cifra los campos de la base de datos.
 */
const MAGIA = Buffer.from('SGVBK1\n', 'utf8');
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;
const LARGO_CABECERA = MAGIA.length + LARGO_IV;

function llaveRespaldo() {
  const base = process.env.DATA_ENC_KEY || `datos-derivada:${process.env.JWT_SECRET || ''}`;
  return Buffer.from(crypto.hkdfSync('sha256', base, 'sigevac-respaldos', 'aes-256-gcm', 32));
}

async function cifrarArchivo(rutaOrigen, rutaDestino) {
  const iv = crypto.randomBytes(LARGO_IV);
  const cifrador = crypto.createCipheriv('aes-256-gcm', llaveRespaldo(), iv);
  const flujo = new Transform({
    transform(trozo, _enc, cb) { cb(null, cifrador.update(trozo)); },
    flush(cb) {
      try {
        this.push(cifrador.final());
        this.push(cifrador.getAuthTag());
        cb();
      } catch (err) { cb(err); }
    },
  });
  flujo.push(Buffer.concat([MAGIA, iv]));
  try {
    await pipeline(fs.createReadStream(rutaOrigen), flujo, fs.createWriteStream(rutaDestino, { mode: 0o600 }));
  } catch (err) {
    fs.rmSync(rutaDestino, { force: true });
    throw err;
  }
}

/** Descifra y VERIFICA la integridad: si la llave es otra o el archivo fue alterado, lanza error y no deja salida. */
async function descifrarArchivo(rutaOrigen, rutaDestino) {
  const { size } = fs.statSync(rutaOrigen);
  if (size < LARGO_CABECERA + LARGO_ETIQUETA) throw new Error('El archivo no es un respaldo cifrado válido.');
  const fd = fs.openSync(rutaOrigen, 'r');
  const cabecera = Buffer.alloc(LARGO_CABECERA);
  const etiqueta = Buffer.alloc(LARGO_ETIQUETA);
  try {
    fs.readSync(fd, cabecera, 0, LARGO_CABECERA, 0);
    fs.readSync(fd, etiqueta, 0, LARGO_ETIQUETA, size - LARGO_ETIQUETA);
  } finally {
    fs.closeSync(fd);
  }
  if (!cabecera.subarray(0, MAGIA.length).equals(MAGIA)) throw new Error('El archivo no es un respaldo cifrado de SIGEVAC.');
  const descifrador = crypto.createDecipheriv('aes-256-gcm', llaveRespaldo(), cabecera.subarray(MAGIA.length));
  descifrador.setAuthTag(etiqueta);
  try {
    await pipeline(
      fs.createReadStream(rutaOrigen, { start: LARGO_CABECERA, end: size - LARGO_ETIQUETA - 1 }),
      descifrador,
      fs.createWriteStream(rutaDestino, { mode: 0o600 }),
    );
  } catch {
    fs.rmSync(rutaDestino, { force: true });
    throw new Error('No se pudo descifrar el respaldo: la llave DATA_ENC_KEY no coincide o el archivo fue alterado.');
  }
}

const esArchivoCifrado = (ruta) => String(ruta).endsWith('.enc');

module.exports = { cifrarArchivo, descifrarArchivo, esArchivoCifrado };
