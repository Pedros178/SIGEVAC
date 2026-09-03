const fs = require('fs/promises');
const { TIPOS_PERMITIDOS } = require('../config/uploads');

/**
 * file-type v22+ es un paquete ESM-only (sin build CommonJS), mientras que
 * el resto del backend usa require()/CommonJS. Node permite usar import()
 * dinámico (que devuelve una Promise) desde código CommonJS sin problema,
 * así que en vez de convertir todo el backend a ESM por una sola
 * dependencia, cacheamos la promesa del import — solo se resuelve una vez,
 * en la primera petición que sube un archivo, y las siguientes reutilizan
 * el mismo módulo ya cargado.
 */
let cargaFileType;
function obtenerFileType() {
  if (!cargaFileType) cargaFileType = import('file-type');
  return cargaFileType;
}

/**
 * multer + fileFilter (config/uploads.js) solo valida el `mimetype` que
 * el navegador declara en la petición multipart — un dato que el cliente
 * controla por completo y que se falsea con una sola línea (curl -F
 * "archivo=@malware.exe;type=application/pdf"). Ese filtro sirve para
 * rechazar rápido lo obviamente inválido, pero NO es una garantía de
 * seguridad por sí solo.
 *
 * Este middleware corre DESPUÉS de multer (cuando el archivo ya está en
 * `req.file`, guardado en disco por diskStorage) y verifica el tipo real
 * inspeccionando los primeros bytes del archivo ("magic numbers"), que no
 * dependen de nada que el cliente declare. Si no coincide con la whitelist,
 * borra el archivo recién subido y responde 400 — nunca lo deja llegar
 * al controlador ni a Supabase Storage.
 *
 * Nota: los CSV no tienen magic bytes (son texto plano), así que para ese
 * caso se hace una verificación superficial de contenido en vez de usar
 * file-type.
 */
async function verificarContenidoArchivo(req, res, next) {
  if (!req.file) return next();

  try {
    const tipoDeclarado = req.file.mimetype;
    const esCsvDeclarado = tipoDeclarado === 'text/csv';

    if (esCsvDeclarado) {
      const muestra = await leerPrimerosBytes(req.file.path, 4096);
      if (contieneBytesBinarios(muestra)) {
        await borrarArchivo(req.file.path);
        return res.status(400).json({
          error: 'El archivo declarado como CSV no parece ser texto plano válido.',
        });
      }
      return next();
    }

    const { fileTypeFromFile } = await obtenerFileType();
    const tipoReal = await fileTypeFromFile(req.file.path);
    const mimeReal = normalizarMimeLegado(tipoReal?.mime, tipoDeclarado);

    if (!mimeReal || !TIPOS_PERMITIDOS.has(mimeReal)) {
      await borrarArchivo(req.file.path);
      return res.status(400).json({
        error: 'El contenido del archivo no coincide con un tipo permitido (PDF, PNG, JPG, WEBP o Excel/CSV).',
      });
    }

    // Defensa en profundidad: si el contenido real no coincide con lo que
    // el cliente declaró (aunque ambos estén en la whitelist), lo tratamos
    // como sospechoso en vez de aceptarlo silenciosamente.
    if (mimeReal !== tipoDeclarado) {
      await borrarArchivo(req.file.path);
      return res.status(400).json({
        error: 'El tipo de archivo declarado no coincide con su contenido real.',
      });
    }

    return next();
  } catch (err) {
    if (req.file?.path) await borrarArchivo(req.file.path);
    return next(err);
  }
}

async function leerPrimerosBytes(ruta, cantidad) {
  const handle = await fs.open(ruta, 'r');
  try {
    const buffer = Buffer.alloc(cantidad);
    const { bytesRead } = await handle.read(buffer, 0, cantidad, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * file-type detecta el contenedor binario genérico ("cfb", Compound File
 * Binary) para archivos .xls antiguos, no el mimetype específico de Excel
 * — esa es una limitación conocida de la librería, no un archivo inválido.
 * Si el cliente declaró un .xls legítimo y el contenido real es un CFB,
 * lo aceptamos como tal en vez de rechazar un archivo válido.
 */
function normalizarMimeLegado(mimeDetectado, mimeDeclarado) {
  if (mimeDetectado === 'application/x-cfb' && mimeDeclarado === 'application/vnd.ms-excel') {
    return 'application/vnd.ms-excel';
  }
  return mimeDetectado;
}

function contieneBytesBinarios(buffer) {
  // Heurística simple: un CSV/texto real no debería traer bytes nulos.
  return buffer.includes(0x00);
}

async function borrarArchivo(ruta) {
  await fs.unlink(ruta).catch(() => {});
}

module.exports = { verificarContenidoArchivo };
