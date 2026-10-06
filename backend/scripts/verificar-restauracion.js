#!/usr/bin/env node
/**
 * Compara dos bases (la original y la restaurada) tabla por tabla: número de filas y una huella
 * del contenido. Úsalo después de restaurar un respaldo para comprobar que no se perdió nada.
 *
 * Uso: node scripts/verificar-restauracion.js <URL_ORIGEN> <URL_RESTAURADA>
 * Nota: si la base de origen sigue recibiendo escrituras, las diferencias pueden ser legítimas
 * (se escribió después del respaldo). Compara contra una base quieta o un respaldo reciente.
 */
const { Client } = require('pg');

async function huellas(url) {
  const c = new Client({ connectionString: url, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();
  const { rows: tablas } = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  const resultado = {};
  for (const { tablename } of tablas) {
    // md5 del contenido ordenado: detecta filas alteradas, no solo conteos distintos
    const { rows } = await c.query(`SELECT count(*)::int AS n, COALESCE(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS huella FROM "${tablename}" t`);
    resultado[tablename] = rows[0];
  }
  await c.end();
  return resultado;
}

(async () => {
  const [origen, restaurada] = process.argv.slice(2);
  if (!origen || !restaurada) { console.error('Uso: node scripts/verificar-restauracion.js <URL_ORIGEN> <URL_RESTAURADA>'); process.exit(2); }
  const [a, b] = await Promise.all([huellas(origen), huellas(restaurada)]);
  const nombres = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let diferencias = 0; let filas = 0;
  for (const t of nombres) {
    if (!a[t] || !b[t]) { console.log(`❌ ${t}: solo existe en ${a[t] ? 'el origen' : 'la restaurada'}`); diferencias++; continue; }
    filas += a[t].n;
    if (a[t].n !== b[t].n || a[t].huella !== b[t].huella) { console.log(`❌ ${t}: origen ${a[t].n} filas, restaurada ${b[t].n} filas${a[t].n === b[t].n ? ' (mismo conteo, CONTENIDO distinto)' : ''}`); diferencias++; }
  }
  console.log(`${nombres.length} tablas, ${filas} filas comparadas → ${diferencias === 0 ? '✅ idénticas' : `❌ ${diferencias} diferencia(s)`}`);
  process.exit(diferencias === 0 ? 0 : 1);
})().catch((e) => { console.error('❌', e.message); process.exit(2); });
