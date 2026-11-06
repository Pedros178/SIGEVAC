const crypto = require('crypto');

const PREFIJO = 'enc:v1:'; // mismo formato que utils/cifrado.js

const derivarLlave = (base) => crypto.createHash('sha256').update(base).digest();

function descifrarCon(llave, valor) {
  const datos = Buffer.from(valor.slice(PREFIJO.length), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', llave, datos.subarray(0, 12));
  d.setAuthTag(datos.subarray(12, 28));
  return Buffer.concat([d.update(datos.subarray(28)), d.final()]).toString('utf8');
}

function cifrarCon(llave, texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', llave, iv);
  const cifrado = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return `${PREFIJO}${Buffer.concat([iv, c.getAuthTag(), cifrado]).toString('base64')}`;
}

/**
 * Re-cifra los secretos 2FA de `usuarios` de la llave anterior a la nueva, SIN que nadie tenga que
 * reactivar su 2FA. `baseAnterior` es el texto del que salía la llave vieja: `TWO_FACTOR_ENC_KEY`
 * anterior, o `2fa-derivada:<JWT_SECRET>` si no había (el valor por defecto del código antiguo).
 * Idempotente: un secreto que ya se descifra con la llave nueva se omite. Todo en una transacción:
 * si algún secreto no se puede descifrar con NINGUNA de las dos llaves, no se modifica nada.
 */
async function reencriptarSecretos2fa(client, { baseAnterior, baseNueva, simular = false }) {
  const llaveVieja = derivarLlave(baseAnterior);
  const llaveNueva = derivarLlave(baseNueva);
  const resultado = { total: 0, migrados: 0, ya_migrados: 0, ilegibles: [], en_claro: 0 };
  await client.query('BEGIN');
  try {
    const { rows } = await client.query(`SELECT id, two_factor_secret FROM usuarios WHERE two_factor_secret IS NOT NULL FOR UPDATE`);
    for (const fila of rows) {
      resultado.total += 1;
      const valor = fila.two_factor_secret;
      if (!valor.startsWith(PREFIJO)) { resultado.en_claro += 1; continue; } // dato heredado en claro: la app lo lee tal cual
      let claro;
      try {
        descifrarCon(llaveNueva, valor);
        resultado.ya_migrados += 1;
        continue;
      } catch { /* aún no está con la llave nueva */ }
      try {
        claro = descifrarCon(llaveVieja, valor);
      } catch {
        resultado.ilegibles.push(fila.id);
        continue;
      }
      resultado.migrados += 1;
      if (!simular) await client.query('UPDATE usuarios SET two_factor_secret = $2 WHERE id = $1', [fila.id, cifrarCon(llaveNueva, claro)]);
    }
    if (resultado.ilegibles.length) {
      await client.query('ROLLBACK');
      resultado.revertido = true;
      return resultado;
    }
    await client.query(simular ? 'ROLLBACK' : 'COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

module.exports = { reencriptarSecretos2fa, derivarLlave, cifrarCon, descifrarCon };
