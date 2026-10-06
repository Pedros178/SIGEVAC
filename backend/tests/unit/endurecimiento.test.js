const { validarEntornoProduccion } = require('../../src/utils/validarEntorno');
const { cifrar, descifrar } = require('../../src/utils/cifrado');
const { esMenorDeEdad, calcularEdad, fechaValida } = require('../../src/utils/edad');
const { leerPaginacion } = require('../../src/utils/paginacion');
const { contentDisposition } = require('../../src/utils/contentDisposition');
const { esUuid } = require('../../src/utils/identificadores');

const ENV_BUENO = {
  DATABASE_URL: 'postgresql://app:Xk29fh2Lp0qZ@db.example.net:5432/sigevac',
  JWT_SECRET: 'a'.repeat(10) + 'f3Z9qLm2Xv8TrPw0YbN7cHd5KsJ1eUg4'.slice(0, 30),
  JWT_REFRESH_SECRET: 'Q7wE2rT9yU1iO4pA6sD8fG0hJ3kL5zX7cV9bN2mQ4wE6rT8y',
  FRONTEND_URL: 'https://app.example.org', SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_STORAGE_BUCKET: 'b',
};

describe('A-04 validarEntornoProduccion', () => {
  test('acepta una configuración con secretos aleatorios y distintos', () => {
    expect(validarEntornoProduccion(ENV_BUENO)).toEqual([]);
  });
  test('rechaza los secretos de ejemplo del .env.example', () => {
    const p = validarEntornoProduccion({ ...ENV_BUENO, JWT_SECRET: 'super_secreto_desarrollo_sigevac_2026_key_123' });
    expect(p.join(' ')).toMatch(/JWT_SECRET.*ejemplo/);
  });
  test('rechaza secretos cortos, iguales entre sí y contraseña de BD trivial', () => {
    expect(validarEntornoProduccion({ ...ENV_BUENO, JWT_SECRET: 'corto' }).join(' ')).toMatch(/demasiado corto/);
    expect(validarEntornoProduccion({ ...ENV_BUENO, JWT_REFRESH_SECRET: ENV_BUENO.JWT_SECRET }).join(' ')).toMatch(/distintos/);
    expect(validarEntornoProduccion({ ...ENV_BUENO, DATABASE_URL: 'postgresql://postgres:admin123@h/db' }).join(' ')).toMatch(/contraseña/);
  });
  test('reporta variables faltantes', () => {
    expect(validarEntornoProduccion({}).join(' ')).toMatch(/Faltan variables/);
  });
});

describe('cifrado de secretos 2FA', () => {
  test('ida y vuelta, IV distinto cada vez y compatibilidad con valores heredados en claro', () => {
    const a = cifrar('JBSWY3DPEHPK3PXP'); const b = cifrar('JBSWY3DPEHPK3PXP');
    expect(a).not.toEqual(b);
    expect(descifrar(a)).toBe('JBSWY3DPEHPK3PXP');
    expect(descifrar('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });
  test('un valor manipulado no se descifra (GCM autentica)', () => {
    const c = cifrar('secreto'); const roto = `${c.slice(0, -4)}AAAA`;
    expect(() => descifrar(roto)).toThrow();
  });
});

describe('edad y fechas (sin dependencia de la zona horaria)', () => {
  const hoy = new Date(2026, 5, 15); // 15-jun-2026 local
  test('límites de la mayoría de edad', () => {
    expect(esMenorDeEdad('2008-06-15', hoy)).toBe(false); // cumple 18 hoy
    expect(esMenorDeEdad('2008-06-16', hoy)).toBe(true);  // los cumple mañana
    expect(calcularEdad('2008-06-14', hoy)).toBe(18);
  });
  test('fechas imposibles o ilegibles', () => {
    expect(fechaValida('2026-02-30')).toBe(false);
    expect(fechaValida('abc')).toBe(false);
    expect(fechaValida('2024-02-29')).toBe(true);
  });
});

describe('utilidades de entrada', () => {
  test('leerPaginacion normaliza valores hostiles', () => {
    expect(leerPaginacion({ limit: 'abc', offset: '-4' })).toEqual({ limit: 50, offset: 0 });
    expect(leerPaginacion({ limit: '999999999' })).toEqual({ limit: 200, offset: 0 });
    expect(leerPaginacion({ limit: '10', offset: '20' })).toEqual({ limit: 10, offset: 20 });
  });
  test('esUuid', () => {
    expect(esUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(esUuid("1' OR '1'='1")).toBe(false);
    expect(esUuid(123)).toBe(false);
  });
  test('contentDisposition conserva acentos (RFC 5987) y neutraliza inyección', () => {
    const h = contentDisposition('attachment', 'Constancia María.pdf');
    expect(h).toContain("filename*=UTF-8''Constancia%20Mar%C3%ADa.pdf");
    expect(h).not.toMatch(/%C3%AD"/);
    expect(contentDisposition('inline', 'a"\r\nSet-Cookie: x=1')).not.toMatch(/[\r\n]/);
  });
});

describe('M-08 sanitizado de la auditoría', () => {
  const { sanitizarBody } = require('../../src/middlewares/trazabilidad');
  test('oculta secretos a cualquier profundidad', () => {
    const r = sanitizarBody({ nombre: 'Ana', tutor: { nombre: 'T', password: 'x', datos: { codigo: '123456' } }, lista: [{ token: 'abc' }] });
    expect(JSON.stringify(r)).not.toMatch(/"x"|123456|abc/);
    expect(r.nombre).toBe('Ana');
    expect(r.tutor.nombre).toBe('T');
  });
  test('recorta textos enormes (firmas base64) y arreglos largos', () => {
    const r = sanitizarBody({ imagenPngBase64: `data:image/png;base64,${'A'.repeat(500000)}`, ids: Array.from({ length: 500 }, (_, i) => i) });
    expect(JSON.stringify(r).length).toBeLessThan(1000);
    expect(r.imagenPngBase64).toMatch(/recortado, 500022 caracteres/);
    expect(r.ids).toHaveLength(21);
  });
  test('no se cicla ni explota con anidamiento profundo', () => {
    let o = { fin: 'x' }; for (let i = 0; i < 100; i++) o = { h: o };
    expect(() => JSON.stringify(sanitizarBody(o))).not.toThrow();
  });
});
