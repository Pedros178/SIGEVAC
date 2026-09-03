/**
 * Ejecuta database/schema.sql contra la base de datos configurada en DATABASE_URL.
 * Uso: npm run db:setup
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

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();

  console.log('Aplicando schema.sql a la base de datos...');
  const client = await pool.connect();
  try {
    await client.query(schemaSql);
    for (const migracion of migrations) {
      console.log(`Aplicando ${migracion}...`);
      await client.query(fs.readFileSync(path.join(migrationsDir, migracion), 'utf8'));
    }
    console.log('✅ Esquema aplicado correctamente.');
  } catch (err) {
    console.error('❌ Error aplicando el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
