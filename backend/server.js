const app = require('./app');
const { programarRevisionDiaria } = require('./src/jobs/vigenciaJob');
const { almacenamientoRemoto } = require('./src/config/storage');
const { pool } = require('./src/config/database');
const { programarPurgaBitacora } = require('./src/utils/retencionBitacora');

const PORT = process.env.PORT || 4000;

const servidor = app.listen(PORT, () => {
  console.log(`SIGEVAC API corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);

  if (!almacenamientoRemoto) {
    // Advertencia visible SIEMPRE (no solo si NODE_ENV === 'production'):
    // si alguien despliega en Render sin fijar NODE_ENV=production
    // exactamente, la validación de variables obligatorias de app.js no
    // se dispara y el backend arranca "bien" — pero guardando archivos en
    // el disco local, que en el plan gratuito de Render se borra en cada
    // reinicio/redeploy/hibernación. El síntoma visible, semanas después,
    // es "las fotos de la galería (y documentos subidos) ya no cargan"
    // sin que nada en el código haya cambiado. Este log aparece en cada
    // arranque para que sea imposible pasarlo por alto revisando los
    // logs del servicio en Render.
    console.warn(
      '⚠️  Almacenamiento de archivos: usando DISCO LOCAL (uploads/). '
      + 'Si esto corre en Render (u otra plataforma sin disco persistente), '
      + 'las imágenes y documentos subidos se PERDERÁN en el próximo reinicio '
      + 'o redeploy. Configura SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y '
      + 'SUPABASE_STORAGE_BUCKET para usar almacenamiento persistente '
      + '(ver DEPLOY.md, sección "Almacenamiento de archivos").'
    );
  }

  programarPurgaBitacora(); // retención de bitácora (03:00)
  programarRevisionDiaria(); // Módulo 17 (diferenciador): alertas de vigencia, todos los días 08:00
});

async function apagar(signal) {
  console.log(`Recibida señal ${signal}. Cerrando SIGEVAC...`);
  // Deja de aceptar conexiones, espera a las que están en curso y cierra el pool de BD
  const forzar = setTimeout(() => process.exit(1), 10_000);
  forzar.unref();
  servidor.close(async () => {
    try { await pool.end(); } catch (err) { console.error('Error cerrando el pool de BD:', err.message); }
    process.exit(0);
  });
}

// Un rechazo de promesa no capturado terminaría el proceso sin dejar rastro
// en versiones recientes de Node; se registra explícitamente.
process.on('unhandledRejection', (motivo) => {
  console.error('unhandledRejection:', motivo);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  apagar('uncaughtException');
});

process.once('SIGTERM', () => apagar('SIGTERM'));
process.once('SIGINT', () => apagar('SIGINT'));
