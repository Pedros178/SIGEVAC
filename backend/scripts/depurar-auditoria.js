#!/usr/bin/env node
/**
 * Oculta, en los registros de auditoría ya guardados, los datos personales sensibles que antes se
 * almacenaban en claro (salud, CURP, domicilio, teléfonos, contacto de emergencia...).
 *
 * Contexto: hasta la Fase 13, `auditoria.detalle` guardaba el cuerpo de cada alta/edición tal cual, así
 * que una alergia o un CURP quedaban en claro ahí aunque la tabla `voluntarios` ya los cifrara.
 * El middleware ya no los guarda; este script limpia lo HISTÓRICO. Es idempotente y por lotes.
 *
 * Uso:  npm run db:scrub-audit              # aplica
 *       npm run db:scrub-audit -- --simular # solo cuenta
 */
require('dotenv').config();
const { Pool } = require('pg');
const { sanitizarBody } = require('../src/middlewares/trazabilidad');

// Misma lista de claves que usa el middleware (se prefiltra en SQL para no recorrer toda la tabla).
const PREFILTRO = '(sangre|alergia|discapacid|enfermedad|salud|curp|"ine"|ine_?tutor|domicilio|direccion|colonia|telefono|celular|nacimiento|emergencia)';
const LOTE = 500;

async function main() {
  const simular = process.argv.includes('--simular');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  let ultimoId = '00000000-0000-0000-0000-000000000000';
  let revisadas = 0;
  let modificadas = 0;
  try {
    for (;;) {
      const { rows } = await pool.query(
        `SELECT id, detalle FROM auditoria WHERE id > $1 AND detalle IS NOT NULL AND detalle::text ~* $2 ORDER BY id LIMIT $3`,
        [ultimoId, PREFILTRO, LOTE]
      );
      if (!rows.length) break;
      for (const fila of rows) {
        revisadas += 1;
        const limpio = sanitizarBody(fila.detalle);
        if (JSON.stringify(limpio) !== JSON.stringify(fila.detalle)) {
          modificadas += 1;
          if (!simular) await pool.query('UPDATE auditoria SET detalle = $2::jsonb WHERE id = $1', [fila.id, JSON.stringify(limpio)]);
        }
      }
      ultimoId = rows[rows.length - 1].id;
    }
    console.log(`${simular ? '[simulación] ' : ''}Registros revisados: ${revisadas}; con datos sensibles ${simular ? 'por ocultar' : 'ocultados'}: ${modificadas}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
