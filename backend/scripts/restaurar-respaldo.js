#!/usr/bin/env node
/**
 * Restaura un respaldo SQL (generado por la propia app o por pg_dump) en una base de datos.
 *
 * Uso:
 *   node scripts/restaurar-respaldo.js <archivo.sql> <URL_DE_LA_BD_DESTINO> [--forzar]
 *   npm run db:restore -- backups/sigevac_2026-10-01.sql postgresql://usuario:clave@host:5432/sigevac_restaurada
 *
 * Seguridad:
 *  - La URL de destino es OBLIGATORIA y explícita: nunca usa DATABASE_URL por omisión, para que
 *    nadie sobrescriba producción por un descuido.
 *  - Se niega a restaurar sobre una base que ya tenga tablas, salvo --forzar.
 *  - Todo corre en UNA transacción (--single-transaction) y se detiene en el primer error
 *    (ON_ERROR_STOP): o se restaura completo, o no se toca nada.
 *  - La contraseña viaja por variable de entorno (PGPASSWORD), no por argumentos.
 *  - Requiere el cliente `psql` instalado.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const { Client } = require('pg');

function variablesPg(url) {
  const u = new URL(url);
  return {
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')),
    ...(u.searchParams.get('sslmode') ? { PGSSLMODE: u.searchParams.get('sslmode') } : {}),
  };
}

async function main() {
  const [archivo, destino, ...banderas] = process.argv.slice(2);
  if (!archivo || !destino) {
    console.error('Uso: node scripts/restaurar-respaldo.js <archivo.sql> <URL_BD_DESTINO> [--forzar]');
    process.exit(2);
  }
  if (!fs.existsSync(archivo)) { console.error(`❌ No existe el archivo: ${archivo}`); process.exit(2); }
  const forzar = banderas.includes('--forzar');

  const cliente = new Client({ connectionString: destino, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await cliente.connect();
  const { rows } = await cliente.query(`SELECT count(*)::int AS tablas FROM information_schema.tables WHERE table_schema = 'public'`);
  const { rows: nombre } = await cliente.query('SELECT current_database() AS bd');
  await cliente.end();
  if (rows[0].tablas > 0 && !forzar) {
    console.error(`❌ La base "${nombre[0].bd}" ya tiene ${rows[0].tablas} tablas. Restaura sobre una base VACÍA, o usa --forzar si estás seguro (se mezclará/fallará).`);
    process.exit(3);
  }

  console.log(`Restaurando ${archivo} en la base "${nombre[0].bd}"...`);
  try {
    execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-f', archivo], {
      env: { ...process.env, ...variablesPg(destino) }, stdio: ['ignore', 'ignore', 'inherit'],
    });
  } catch (err) {
    if (err.code === 'ENOENT') console.error('❌ No se encontró `psql`. Instala el cliente de PostgreSQL.');
    else console.error('❌ La restauración falló y se revirtió por completo (no quedó nada a medias).');
    process.exit(1);
  }
  console.log('✅ Restauración completada. Verifica con: npm run db:verify-restore -- <URL_ORIGEN> <URL_RESTAURADA>');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
