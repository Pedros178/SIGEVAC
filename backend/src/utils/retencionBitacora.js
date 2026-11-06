const { query } = require('../config/database');

/**
 * Elimina registros de bitácora/auditoría más antiguos que N días
 * (BITACORA_RETENCION_DIAS, 365 por defecto). La bitácora registra TODA
 * petición autenticada: sin purga la tabla crece sin límite. La migración 014
 * ya mencionaba este mecanismo, pero el archivo no existía.
 */
async function purgarBitacora(dias = Number.parseInt(process.env.BITACORA_RETENCION_DIAS || '365', 10)) {
  const retencion = Number.isFinite(dias) && dias >= 30 ? dias : 365; // nunca menos de 30 días
  const b = await query(`DELETE FROM bitacora WHERE creado_en < now() - ($1 || ' days')::interval`, [String(retencion)]);
  const a = await query(`DELETE FROM auditoria WHERE creado_en < now() - ($1 || ' days')::interval`, [String(retencion * 2)]);
  return { bitacora: b.rowCount, auditoria: a.rowCount, dias: retencion };
}

/**
 * Minimización de datos: las sesiones guardan IP y user-agent, y los tokens de recuperación apuntan a
 * una cuenta. Una vez caducados o usados ya no sirven para nada, así que se borran tras un margen
 * (por defecto 30 días, para poder investigar un incidente reciente). Devuelve cuántos se eliminaron.
 */
async function purgarCredencialesCaducadas(diasMargen = Number.parseInt(process.env.SESIONES_RETENCION_DIAS || '30', 10)) {
  const margen = Number.isFinite(diasMargen) && diasMargen >= 1 ? diasMargen : 30;
  const s = await query(
    `DELETE FROM sesiones WHERE expira_en < now() - ($1 || ' days')::interval OR (revocado = true AND creado_en < now() - ($1 || ' days')::interval)`,
    [String(margen)]
  );
  const t = await query(
    `DELETE FROM tokens_recuperacion WHERE expira_en < now() - ($1 || ' days')::interval OR (usado = true AND creado_en < now() - ($1 || ' days')::interval)`,
    [String(margen)]
  );
  return { sesiones: s.rowCount, tokens_recuperacion: t.rowCount, dias: margen };
}

/** Programa la purga diaria (03:00, hora del servidor). No corre en pruebas. */
function programarPurgaBitacora() {
  if (process.env.NODE_ENV === 'test') return null;
  const cron = require('node-cron');
  return cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[retencionBitacora] Purga completada:', await purgarBitacora());
      console.log('[retencionBitacora] Credenciales caducadas:', await purgarCredencialesCaducadas());
    } catch (err) {
      console.error('[retencionBitacora] Error en la purga:', err.message);
    }
  });
}

module.exports = { purgarBitacora, purgarCredencialesCaducadas, programarPurgaBitacora };
