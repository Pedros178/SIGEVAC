const { calcularNivel } = require('../../src/services/gamificacionService');

describe('services/gamificacionService — calcularNivel', () => {
  test('0 horas corresponde a nivel bronce, con "plata" como siguiente objetivo', () => {
    const nivel = calcularNivel(0);
    expect(nivel.clave).toBe('bronce');
    expect(nivel.siguiente_nivel.etiqueta).toBe('Plata');
    expect(nivel.siguiente_nivel.horas_faltantes).toBe(20);
  });

  test('19.99 horas todavía es bronce (el umbral de plata es 20)', () => {
    expect(calcularNivel(19.99).clave).toBe('bronce');
  });

  test('20 horas exactas ya es plata', () => {
    expect(calcularNivel(20).clave).toBe('plata');
  });

  test('75 horas es oro, con "Platino" como siguiente objetivo', () => {
    const nivel = calcularNivel(75);
    expect(nivel.clave).toBe('oro');
    expect(nivel.siguiente_nivel.etiqueta).toBe('Platino');
    expect(nivel.siguiente_nivel.horas_faltantes).toBe(25);
  });

  test('100 horas o más es platino y no tiene siguiente nivel', () => {
    const nivel = calcularNivel(150);
    expect(nivel.clave).toBe('platino');
    expect(nivel.siguiente_nivel).toBeNull();
  });

  test('valores no numéricos o nulos se tratan como 0 horas', () => {
    expect(calcularNivel(undefined).clave).toBe('bronce');
    expect(calcularNivel(null).clave).toBe('bronce');
  });
});
