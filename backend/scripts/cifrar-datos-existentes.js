#!/usr/bin/env node
/**
 * Cifra en su lugar los datos de salud que ya estaban guardados en claro
 * (tipo_sangre, alergias, discapacidad, enfermedad_cronica de `voluntarios`).
 *
 * Uso:  npm run db:encrypt-existing            # aplica el cifrado
 *       npm run db:encrypt-existing -- --simular   # solo cuenta, no modifica
 *
 * Es IDEMPOTENTE: los valores que ya empiezan con el prefijo `encd:v1:` se
 * omiten, así que se puede ejecutar varias veces o después de cada despliegue.
 * Requiere DATA_ENC_KEY (la misma que usará la API). TODO en una transacción.
 * Haz un respaldo antes de la primera ejecución.
 */
require('dotenv').config();
const { Pool } = require('pg');
const { cifrarDato, estaCifrado, COLUMNAS_SENSIBLES_VOLUNTARIO } = require('../src/utils/cifradoDatos');

async function main() {
  const simular = process.argv.includes('--simular');
  if (!process.env.DATA_ENC_KEY && process.env.NODE_ENV === 'production') {
    console.error('❌ Falta DATA_ENC_KEY. Defínela antes de cifrar (y guárdala: sin ella los datos no se recuperan).');
    process.exit(2);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  let filas = 0;
  let valores = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id, ${COLUMNAS_SENSIBLES_VOLUNTARIO.join(', ')} FROM voluntarios FOR UPDATE`);
    for (const fila of rows) {
      const cambios = {};
      for (const col of COLUMNAS_SENSIBLES_VOLUNTARIO) {
        if (fila[col] && !estaCifrado(fila[col])) cambios[col] = cifrarDato(fila[col]);
      }
      const columnas = Object.keys(cambios);
      if (!columnas.length) continue;
      filas += 1;
      valores += columnas.length;
      if (!simular) {
        const sets = columnas.map((c, i) => `${c} = $${i + 1}`).join(', ');
        await client.query(`UPDATE voluntarios SET ${sets} WHERE id = $${columnas.length + 1}`, [...columnas.map((c) => cambios[c]), fila.id]);
      }
    }
    await client.query(simular ? 'ROLLBACK' : 'COMMIT');
    console.log(`${simular ? '[simulación] ' : ''}Voluntarios con datos por cifrar: ${filas} (${valores} valores).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error; no se modificó nada:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
