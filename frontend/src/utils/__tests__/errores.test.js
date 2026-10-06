import { describe, test, expect } from 'vitest';
import { mensajeDeError } from '../errores.js';

describe('mensajeDeError', () => {
  test('usa el mensaje del servidor cuando existe', () => {
    expect(mensajeDeError({ response: { status: 401, data: { error: 'Credenciales inválidas.' } } })).toBe('Credenciales inválidas.');
  });
  test('sin respuesta (servidor caído) no muestra el texto técnico del navegador', () => {
    for (const err of [new TypeError('Failed to fetch'), new TypeError('Load failed'), { message: 'Network Error', code: 'ERR_NETWORK' }]) {
      const texto = mensajeDeError(err);
      expect(texto).toMatch(/No se pudo conectar con el servidor/);
      expect(texto).not.toMatch(/fetch|Network|Load failed/i);
    }
  });
  test('un Error lanzado por la app con mensaje del servidor (Login usa fetch) se conserva', () => {
    expect(mensajeDeError(new Error('Credenciales inválidas o cuenta bloqueada temporalmente.'))).toBe('Credenciales inválidas o cuenta bloqueada temporalmente.');
  });
  test('429 y errores HTTP sin cuerpo tienen mensajes propios', () => {
    expect(mensajeDeError({ response: { status: 429, data: {} } })).toMatch(/Demasiados intentos/);
    expect(mensajeDeError({ response: { status: 500, data: {} } }, 'Falló X')).toBe('Falló X');
  });
});
