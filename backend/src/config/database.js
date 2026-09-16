const { Pool, types } = require('pg');
require('dotenv').config();

// Por defecto, node-postgres devuelve las columnas DATE como objetos
// JS Date. Al pasar por JSON.stringify (toda respuesta de la API), eso se
// serializa como "2026-09-07T00:00:00.000Z" en vez del simple
// "2026-09-07" que hay en la base de datos — un timestamp con hora y zona
// horaria para un dato que nunca tuvo ninguna de las dos. Esto es
// inofensivo la mayoría de las veces (el frontend suele recortar a los
// primeros 10 caracteres), pero puede desalinear un día completo según la
// zona horaria del servidor, y rompe cualquier comparación exacta de
// fecha (como la vigencia de una foto de la galería). OID 1082 = DATE en
// PostgreSQL; se deja el valor tal cual lo manda la base (ya viene como
// texto 'YYYY-MM-DD' antes de que este parser lo toque).
types.setTypeParser(1082, (valor) => valor);

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
