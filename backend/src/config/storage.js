const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { UPLOADS_DIR } = require('./uploads');

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'sigevac-files';
const almacenamientoRemoto = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabase = almacenamientoRemoto
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

function referenciaRemota(ruta) {
  return `storage://${bucket}/${ruta}`;
}

function esReferenciaRemota(referencia) {
  return typeof referencia === 'string' && referencia.startsWith('storage://');
}

function rutaDesdeReferencia(referencia) {
  return referencia.replace(`storage://${bucket}/`, '');
}

async function guardarArchivo({ rutaLocal, buffer, ruta, contentType }) {
  if (!almacenamientoRemoto) {
    if (rutaLocal) return `/uploads/${path.basename(rutaLocal)}`;
    const destino = path.join(UPLOADS_DIR, path.basename(ruta));
    await fs.writeFile(destino, buffer);
    return `/uploads/${path.basename(destino)}`;
  }

  const contenido = buffer || await fs.readFile(rutaLocal);
  const { error } = await supabase.storage.from(bucket).upload(ruta, contenido, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return referenciaRemota(ruta);
}

async function obtenerArchivo(referencia) {
  if (!esReferenciaRemota(referencia)) {
    return fs.readFile(path.join(UPLOADS_DIR, path.basename(referencia)));
  }

  const { data, error } = await supabase.storage.from(bucket).download(rutaDesdeReferencia(referencia));
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function eliminarArchivo(referencia) {
  if (!referencia) return;
  if (!esReferenciaRemota(referencia)) {
    await fs.unlink(path.join(UPLOADS_DIR, path.basename(referencia))).catch(() => {});
    return;
  }
  await supabase.storage.from(bucket).remove([rutaDesdeReferencia(referencia)]);
}

module.exports = { almacenamientoRemoto, guardarArchivo, obtenerArchivo, eliminarArchivo, esReferenciaRemota };
