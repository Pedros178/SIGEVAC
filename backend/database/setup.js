/**
 * Prepara el esquema de la base de datos configurada en DATABASE_URL.
 * Uso: npm run db:setup
 *
 * Es IDEMPOTENTE y puede ejecutarse en cada despliegue:
 *  1. Si la base está vacía (sin tabla `asociaciones`) aplica schema.sql.
 *  2. Aplica solo las migraciones que no consten en `schema_migrations`,
 *     cada una dentro de su propia transacción (si falla, no queda a medias).
 *
 * Bases creadas con la versión anterior de este script (sin registro de
 * migraciones): la primera ejecución vuelve a aplicar todas las migraciones,
 * que están escritas para tolerarlo (IF NOT EXISTS / ON CONFLICT), y desde
 * entonces quedan registradas.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const migrationsDir = path.join(__dirname, 'migrations');
  const migraciones = fs.readdirSync(migrationsDir).filter((a) => a.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    // Un solo ejecutor a la vez (dos despliegues simultáneos no se pisan)
    await client.query('SELECT pg_advisory_lock(7364291)');

    const { rows: existe } = await client.query(`SELECT to_regclass('public.asociaciones') AS tabla`);
    if (!existe[0].tabla) {
      console.log('Base vacía: aplicando schema.sql...');
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      await client.query('COMMIT');
    } else {
      console.log('El esquema base ya existe: se omite schema.sql.');
    }

    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT nombre FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nombre));

    let nuevas = 0;
    for (const migracion of migraciones) {
      if (aplicadas.has(migracion)) continue;
      console.log(`Aplicando ${migracion}...`);
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(migrationsDir, migracion), 'utf8'));
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [migracion]);
        await client.query('COMMIT');
        nuevas += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${migracion}: ${err.message}`);
      }
    }
    console.log(nuevas ? `✅ Esquema al día (${nuevas} migración(es) nueva(s)).` : '✅ Esquema ya estaba al día.');
  } catch (err) {
    console.error('❌ Error aplicando el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7364291)').catch(() => {});
    client.release();
    await pool.end();
  }
}

main();
