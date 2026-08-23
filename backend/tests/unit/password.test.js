const { hashPassword, compararPassword, generarTokenSeguro, hashSha256 } = require('../../src/utils/password');

describe('utils/password', () => {
  test('hashPassword genera un hash distinto al texto original', async () => {
    const hash = await hashPassword('MiPassword#123');
    expect(hash).not.toBe('MiPassword#123');
    expect(hash.length).toBeGreaterThan(20);
  });

  test('compararPassword devuelve true con la contraseña correcta', async () => {
    const hash = await hashPassword('MiPassword#123');
    await expect(compararPassword('MiPassword#123', hash)).resolves.toBe(true);
  });

  test('compararPassword devuelve false con una contraseña incorrecta', async () => {
    const hash = await hashPassword('MiPassword#123');
    await expect(compararPassword('OtraPassword#456', hash)).resolves.toBe(false);
  });

  test('hashPassword de la misma contraseña produce hashes distintos (salt aleatorio)', async () => {
    const hash1 = await hashPassword('Repetida#123');
    const hash2 = await hashPassword('Repetida#123');
    expect(hash1).not.toBe(hash2);
  });

  test('generarTokenSeguro produce un token distinto en cada llamada, con su hash correspondiente', () => {
    const a = generarTokenSeguro();
    const b = generarTokenSeguro();
    expect(a.tokenPlano).not.toBe(b.tokenPlano);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.tokenHash).toBe(hashSha256(a.tokenPlano));
  });

  test('hashSha256 es determinístico: el mismo valor de entrada produce el mismo hash', () => {
    expect(hashSha256('valor-fijo')).toBe(hashSha256('valor-fijo'));
    expect(hashSha256('valor-fijo')).not.toBe(hashSha256('otro-valor'));
  });
});
