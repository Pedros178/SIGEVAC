const fs = require('fs');
const os = require('os');
const path = require('path');
const { cifrarArchivo, descifrarArchivo, esArchivoCifrado } = require('../../src/utils/cifradoArchivos');

describe('utils/cifradoArchivos (respaldos cifrados)', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cifrado-test-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  const ruta = (n) => path.join(dir, n);

  test('ida y vuelta con un archivo de varios MB (varios trozos del flujo)', async () => {
    const original = Buffer.alloc(3 * 1024 * 1024 + 123);
    for (let i = 0; i < original.length; i += 1) original[i] = (i * 31) % 251;
    fs.writeFileSync(ruta('a.sql'), original);
    await cifrarArchivo(ruta('a.sql'), ruta('a.sql.enc'));
    expect(fs.statSync(ruta('a.sql.enc')).size).toBe(original.length + 7 + 12 + 16);
    await descifrarArchivo(ruta('a.sql.enc'), ruta('b.sql'));
    expect(fs.readFileSync(ruta('b.sql')).equals(original)).toBe(true);
  });

  test('el contenido cifrado no revela el texto original', async () => {
    fs.writeFileSync(ruta('a.sql'), 'INSERT INTO voluntarios VALUES (\'Ana\', \'CURP123\');');
    await cifrarArchivo(ruta('a.sql'), ruta('a.sql.enc'));
    expect(fs.readFileSync(ruta('a.sql.enc')).toString('latin1')).not.toMatch(/INSERT|CURP123|Ana/);
  });

  test('un archivo alterado se rechaza y no deja salida en disco', async () => {
    fs.writeFileSync(ruta('a.sql'), 'contenido '.repeat(1000));
    await cifrarArchivo(ruta('a.sql'), ruta('a.sql.enc'));
    const bytes = fs.readFileSync(ruta('a.sql.enc'));
    bytes[100] ^= 0xff;
    fs.writeFileSync(ruta('a.sql.enc'), bytes);
    await expect(descifrarArchivo(ruta('a.sql.enc'), ruta('b.sql'))).rejects.toThrow(/alterado|llave/);
    expect(fs.existsSync(ruta('b.sql'))).toBe(false);
  });

  test('con otra DATA_ENC_KEY no se puede descifrar', async () => {
    fs.writeFileSync(ruta('a.sql'), 'secreto');
    await cifrarArchivo(ruta('a.sql'), ruta('a.sql.enc'));
    const anterior = process.env.DATA_ENC_KEY;
    process.env.DATA_ENC_KEY = 'otra-llave-completamente-distinta-12345';
    try {
      await expect(descifrarArchivo(ruta('a.sql.enc'), ruta('b.sql'))).rejects.toThrow(/llave/);
    } finally {
      if (anterior === undefined) delete process.env.DATA_ENC_KEY; else process.env.DATA_ENC_KEY = anterior;
    }
  });

  test('un archivo que no es un respaldo cifrado se rechaza', async () => {
    fs.writeFileSync(ruta('x.sql.enc'), 'esto es SQL en claro, no un respaldo cifrado de verdad, relleno relleno');
    await expect(descifrarArchivo(ruta('x.sql.enc'), ruta('y.sql'))).rejects.toThrow(/no es un respaldo/);
    fs.writeFileSync(ruta('corto.enc'), 'abc');
    await expect(descifrarArchivo(ruta('corto.enc'), ruta('z.sql'))).rejects.toThrow(/no es un respaldo/);
  });

  test('esArchivoCifrado detecta la extensión .enc', () => {
    expect(esArchivoCifrado('/x/sigevac.sql.enc')).toBe(true);
    expect(esArchivoCifrado('/x/sigevac.sql')).toBe(false);
  });
});
