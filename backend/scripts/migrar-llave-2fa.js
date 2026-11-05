#!/usr/bin/env node
/**
 * Re-cifra los secretos 2FA existentes con la nueva TWO_FACTOR_ENC_KEY para que NADIE tenga que reactivar su 2FA.
 *
 * Antes de la Fase 13, si no definías TWO_FACTOR_ENC_KEY, la llave se derivaba de JWT_SECRET. Al fijar una llave
 * propia (obligatoria en producción) los secretos viejos dejarían de leerse. Ejecuta esto UNA vez, con:
 *   - TWO_FACTOR_ENC_KEY  = la llave NUEVA (ya definida en el entorno / .env)
 *   - JWT_SECRET          = el actual (de ahí salía la llave vieja)    [o LLAVE_2FA_ANTERIOR=<llave vieja explícita>]
 *
 *   npm run db:migrate-2fa-key -- --simular   # solo cuenta
 *   npm run db:migrate-2fa-key                # aplica (idempotente; todo o nada)
 */
require('dotenv').config();
const { Pool } = require('pg');
const { reencriptarSecretos2fa } = require('../src/utils/migrarLlave2fa');

async function main() {
  const simular = process.argv.includes('--simular');
  const nueva = process.env.TWO_FACTOR_ENC_KEY;
  const anterior = process.env.LLAVE_2FA_ANTERIOR || `2fa-derivada:${process.env.JWT_SECRET || ''}`;
  if (!nueva) { console.error('❌ Define TWO_FACTOR_ENC_KEY (la llave nueva) antes de ejecutar.'); process.exit(2); }
  if (!process.env.LLAVE_2FA_ANTERIOR && !process.env.JWT_SECRET) { console.error('❌ Falta JWT_SECRET (o LLAVE_2FA_ANTERIOR) para reconstruir la llave anterior.'); process.exit(2); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  try {
    const r = await reencriptarSecretos2fa(client, { baseAnterior: anterior, baseNueva: nueva, simular });
    console.log(`${simular ? '[simulación] ' : ''}Secretos 2FA: ${r.total} · migrados: ${r.migrados} · ya con la llave nueva: ${r.ya_migrados} · en claro: ${r.en_claro}`);
    if (r.revertido) {
      console.error(`❌ ${r.ilegibles.length} secreto(s) no se pueden descifrar ni con la llave anterior ni con la nueva; NO se modificó nada. Revisa JWT_SECRET / LLAVE_2FA_ANTERIOR. Usuarios: ${r.ilegibles.join(', ')}`);
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
