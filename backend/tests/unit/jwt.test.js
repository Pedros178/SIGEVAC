const {
  generarAccessToken, verificarAccessToken,
  generarRefreshToken, verificarRefreshToken,
  generarTokenPortal, verificarTokenPortal,
} = require('../../src/utils/jwt');

const usuarioEjemplo = {
  id: 'user-uuid-123',
  correo: 'ana@example.com',
  roles: [{ nombre: 'coordinador' }],
  asociacion_id: 'asoc-uuid-456',
};

describe('utils/jwt', () => {
  test('generarAccessToken produce un token verificable con los datos correctos', () => {
    const token = generarAccessToken(usuarioEjemplo);
    const payload = verificarAccessToken(token);
    expect(payload.sub).toBe(usuarioEjemplo.id);
    expect(payload.correo).toBe(usuarioEjemplo.correo);
    expect(payload.asociacion_id).toBe(usuarioEjemplo.asociacion_id);
    expect(payload.roles).toEqual(usuarioEjemplo.roles);
  });

  test('verificarAccessToken rechaza un token alterado', () => {
    const token = generarAccessToken(usuarioEjemplo);
    const tokenAlterado = token.slice(0, -3) + 'xyz';
    expect(() => verificarAccessToken(tokenAlterado)).toThrow();
  });

  test('generarRefreshToken produce un token verificable con el subject correcto', () => {
    const token = generarRefreshToken(usuarioEjemplo);
    const payload = verificarRefreshToken(token);
    expect(payload.sub).toBe(usuarioEjemplo.id);
  });

  test('un access token no es válido como refresh token (secretos distintos)', () => {
    const accessToken = generarAccessToken(usuarioEjemplo);
    expect(() => verificarRefreshToken(accessToken)).toThrow();
  });

  test('generarTokenPortal produce un token con tipo "portal" y el id del voluntario', () => {
    const token = generarTokenPortal('voluntario-uuid-789');
    const payload = verificarTokenPortal(token);
    expect(payload.tipo).toBe('portal');
    expect(payload.voluntarioId).toBe('voluntario-uuid-789');
  });

  test('verificarTokenPortal rechaza un access token normal (tipo distinto)', () => {
    const accessToken = generarAccessToken(usuarioEjemplo);
    expect(() => verificarTokenPortal(accessToken)).toThrow();
  });
});
