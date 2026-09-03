import { describe, test, expect, beforeEach } from 'vitest';
import { getAccessToken, guardarAccessToken, limpiarAccessToken } from '../api.js';

/**
 * Prueba de regresión de la revisión de seguridad: el access token debe
 * vivir solo en esta variable de módulo (en memoria), nunca en
 * localStorage/sessionStorage — ver el comentario en api.js para el
 * porqué. Estas pruebas cubren el contrato de las funciones que exponen
 * ese estado, que es lo que consumen AuthContext y el interceptor de
 * peticiones.
 */
describe('manejo del access token en memoria (services/api.js)', () => {
  beforeEach(() => {
    limpiarAccessToken();
  });

  test('getAccessToken devuelve null cuando no se ha guardado ningún token', () => {
    expect(getAccessToken()).toBeNull();
  });

  test('guardarAccessToken guarda el token y getAccessToken lo devuelve', () => {
    guardarAccessToken('token-de-prueba-123');
    expect(getAccessToken()).toBe('token-de-prueba-123');
  });

  test('guardarAccessToken con un valor vacío/undefined lo normaliza a null', () => {
    guardarAccessToken('algo');
    guardarAccessToken(undefined);
    expect(getAccessToken()).toBeNull();
  });

  test('limpiarAccessToken borra el token guardado', () => {
    guardarAccessToken('token-de-prueba-456');
    limpiarAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  test('el token nunca se escribe en localStorage ni sessionStorage', () => {
    guardarAccessToken('token-secreto');
    expect(window.localStorage.getItem('sigevac_access_token')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
