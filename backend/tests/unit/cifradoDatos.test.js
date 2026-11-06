const { cifrarDato, descifrarDato, estaCifrado, revelarFila, PREFIJO } = require('../../src/utils/cifradoDatos');

describe('utils/cifradoDatos (datos sensibles en reposo)', () => {
  test('cifra y descifra ida y vuelta, incluyendo acentos y emojis', () => {
    const original = 'Alergia a la penicilina y a los cacahuates 🥜';
    const cifrado = cifrarDato(original);
    expect(cifrado).not.toContain('penicilina');
    expect(cifrado.startsWith(PREFIJO)).toBe(true);
    expect(descifrarDato(cifrado)).toBe(original);
  });

  test('dos cifrados del mismo valor son distintos (IV aleatorio)', () => {
    expect(cifrarDato('O+')).not.toBe(cifrarDato('O+'));
  });

  test('null, undefined y cadena vacía pasan sin cifrar', () => {
    expect(cifrarDato(null)).toBeNull();
    expect(cifrarDato(undefined)).toBeUndefined();
    expect(cifrarDato('')).toBe('');
  });

  test('es idempotente: un valor ya cifrado no se cifra de nuevo', () => {
    const una = cifrarDato('A+');
    expect(cifrarDato(una)).toBe(una);
    expect(estaCifrado(una)).toBe(true);
    expect(estaCifrado('A+')).toBe(false);
  });

  test('un dato heredado en claro se devuelve tal cual al descifrar', () => {
    expect(descifrarDato('B-')).toBe('B-');
  });

  test('un valor alterado falla la autenticación (GCM) en vez de devolver basura', () => {
    const cifrado = cifrarDato('dato importante');
    const bytes = Buffer.from(cifrado.slice(PREFIJO.length), 'base64');
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => descifrarDato(`${PREFIJO}${bytes.toString('base64')}`)).toThrow();
  });

  test('con otra llave no se puede descifrar', () => {
    const cifrado = cifrarDato('secreto');
    const anterior = process.env.DATA_ENC_KEY;
    process.env.DATA_ENC_KEY = 'otra-llave-distinta-de-prueba-0123456789';
    try {
      expect(() => descifrarDato(cifrado)).toThrow();
    } finally {
      if (anterior === undefined) delete process.env.DATA_ENC_KEY; else process.env.DATA_ENC_KEY = anterior;
    }
  });

  test('revelarFila descifra solo las columnas sensibles y no muta la fila original', () => {
    const fila = { nombre: 'Ana', alergias: cifrarDato('polen'), tipo_sangre: cifrarDato('O+'), discapacidad: null };
    const claro = revelarFila(fila);
    expect(claro).toMatchObject({ nombre: 'Ana', alergias: 'polen', tipo_sangre: 'O+', discapacidad: null });
    expect(estaCifrado(fila.alergias)).toBe(true);
    expect(revelarFila(null)).toBeNull();
  });
});
