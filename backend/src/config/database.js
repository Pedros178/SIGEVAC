const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Ejecuta una consulta usando el pool de conexiones.
 * @param {string} text - Consulta SQL parametrizada ($1, $2, ...)
 * @param {Array} params - Parámetros de la consulta
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    const duration = Date.now() - start;
    console.log('SQL ejecutado', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Obtiene un cliente dedicado del pool para transacciones.
 * Recuerda hacer client.release() al terminar.
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = { pool, query, getClient };
