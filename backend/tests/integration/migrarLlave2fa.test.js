const { query, pool } = require('../../src/config/database');
const { reencriptarSecretos2fa, derivarLlave, cifrarCon, descifrarCon } = require('../../src/utils/migrarLlave2fa');
const { descifrar } = require('../../src/utils/cifrado');

describe('Migración de la llave 2FA (sin que nadie reactive su 2FA)', () => {
  const ANTERIOR = '2fa-derivada:jwt-secret-viejo-de-prueba';
  const NUEVA = 'llave-2fa-nueva-de-prueba-0123456789abcdef';
  let ids = [];
  let anteriorEnv;

  async function crearUsuario(secreto) {
    const { rows: [u] } = await query(
      `INSERT INTO usuarios (nombre, correo, password_hash, two_factor_secret, two_factor_activo)
       VALUES ('Usuario 2FA', $1, 'x', $2, true) RETURNING id`,
      [`dosfa.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`, secreto]
    );
    ids.push(u.id);
    return u.id;
  }
  async function conClient(fn) {
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  }
  const leer = async (id) => (await query('SELECT two_factor_secret FROM usuarios WHERE id = $1', [id])).rows[0].two_factor_secret;

  beforeAll(() => { anteriorEnv = process.env.TWO_FACTOR_ENC_KEY; });
  afterEach(async () => {
    if (ids.length) await query('DELETE FROM usuarios WHERE id = ANY($1)', [ids]);
    ids = [];
    if (anteriorEnv === undefined) delete process.env.TWO_FACTOR_ENC_KEY; else process.env.TWO_FACTOR_ENC_KEY = anteriorEnv;
  });

  test('migra de la llave vieja a la nueva y la app lo descifra con la nueva; es idempotente', async () => {
    const id = await crearUsuario(cifrarCon(derivarLlave(ANTERIOR), 'JBSWY3DPEHPK3PXP'));
    const r1 = await conClient((c) => reencriptarSecretos2fa(c, { baseAnterior: ANTERIOR, baseNueva: NUEVA }));
    expect(r1.migrados).toBeGreaterThanOrEqual(1);
    expect(r1.ilegibles).toEqual([]);
    expect(descifrarCon(derivarLlave(NUEVA), await leer(id))).toBe('JBSWY3DPEHPK3PXP');
    process.env.TWO_FACTOR_ENC_KEY = NUEVA; // exactamente como la leerá la aplicación
    expect(descifrar(await leer(id))).toBe('JBSWY3DPEHPK3PXP');

    const r2 = await conClient((c) => reencriptarSecretos2fa(c, { baseAnterior: ANTERIOR, baseNueva: NUEVA }));
    expect(r2.migrados).toBe(0);
    expect(r2.ya_migrados).toBeGreaterThanOrEqual(1);
  });

  test('simulación: cuenta pero no modifica nada', async () => {
    const original = cifrarCon(derivarLlave(ANTERIOR), 'SECRETOSIMULADO');
    const id = await crearUsuario(original);
    const r = await conClient((c) => reencriptarSecretos2fa(c, { baseAnterior: ANTERIOR, baseNueva: NUEVA, simular: true }));
    expect(r.migrados).toBeGreaterThanOrEqual(1);
    expect(await leer(id)).toBe(original);
  });

  test('todo o nada: si un secreto no se puede leer con ninguna llave, no se modifica NINGUNO', async () => {
    const bueno = cifrarCon(derivarLlave(ANTERIOR), 'SECRETOBUENO');
    const idBueno = await crearUsuario(bueno);
    const idMalo = await crearUsuario(cifrarCon(derivarLlave('otra-llave-que-nadie-conoce'), 'SECRETOPERDIDO'));
    const r = await conClient((c) => reencriptarSecretos2fa(c, { baseAnterior: ANTERIOR, baseNueva: NUEVA }));
    expect(r.revertido).toBe(true);
    expect(r.ilegibles).toContain(idMalo);
    expect(await leer(idBueno)).toBe(bueno); // intacto
  });

  test('un secreto heredado en claro se reporta y no se toca', async () => {
    const id = await crearUsuario('SECRETOENCLARO');
    const r = await conClient((c) => reencriptarSecretos2fa(c, { baseAnterior: ANTERIOR, baseNueva: NUEVA }));
    expect(r.en_claro).toBeGreaterThanOrEqual(1);
    expect(await leer(id)).toBe('SECRETOENCLARO');
  });
});
