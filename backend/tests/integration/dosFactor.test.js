const { authenticator } = require('otplib');
const { app, request, loginComoAdmin } = require('./helpers');

/**
 * IMPORTANTE: la implementación original de 2FA usaba una API de `otplib`
 * que no existe (funciones sueltas `generateSecret`/`generateURI`/`verify`,
 * asíncronas, con `verify()` devolviendo `{ valid }`). La librería real
 * expone `authenticator.generateSecret()`, `authenticator.keyuri()` y
 * `authenticator.verify({ token, secret })` — todas síncronas y `verify`
 * devuelve un boolean directo. Esto se corrigió en `authController.js`;
 * esta prueba es la que hubiera detectado el problema de inmediato (con
 * la API vieja, `preparar2FA` truena con TypeError en la primera línea).
 *
 * Usa un usuario dedicado para todo el ciclo de vida de 2FA — nunca se
 * activa 2FA sobre el usuario admin compartido (`CORREO_ADMIN`), porque
 * otros archivos de prueba asumen que ese login no pide segundo factor.
 */
describe('Autenticación de dos factores (2FA / TOTP)', () => {
  let tokenAdmin;
  let tokenUsuario2FA;
  let correoUsuario2FA;
  const PASSWORD = 'DosFactor#123';

  beforeAll(async () => {
    tokenAdmin = (await loginComoAdmin()).access_token;
    correoUsuario2FA = `2fa.usuario.${Date.now()}@sigevac.local`;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Usuario 2FA', correo: correoUsuario2FA, password: PASSWORD, rol: 'coordinador' });
    const login = await request(app).post('/api/auth/login').send({ correo: correoUsuario2FA, password: PASSWORD });
    tokenUsuario2FA = login.body.access_token;
  });

  test('un login normal, sin 2FA activado, no pide segundo factor', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({ correo: correoUsuario2FA, password: PASSWORD });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('access_token');
    expect(respuesta.body.requiere_2fa).toBeFalsy();
  });

  test('POST /auth/2fa/setup regresa un secreto y un QR (aquí truena si otplib está mal usado)', async () => {
    const respuesta = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${tokenUsuario2FA}`)
      .send({ password: PASSWORD });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.secreto).toEqual(expect.any(String));
    expect(respuesta.body.qr).toMatch(/^data:image\/png;base64,/);
  });

  test('activar 2FA con un código inválido responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${tokenUsuario2FA}`)
      .send({ codigo: '000000' });
    expect(respuesta.status).toBe(400);
  });

  test('activar 2FA con el código correcto (generado con el mismo secreto) responde 200', async () => {
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${tokenUsuario2FA}`).send({ password: PASSWORD });
    const codigoValido = authenticator.generate(setup.body.secreto);

    const respuesta = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${tokenUsuario2FA}`)
      .send({ codigo: codigoValido });
    expect(respuesta.status).toBe(200);

    // Guardamos el secreto ya activo para las siguientes pruebas.
    global.__secreto2FA = setup.body.secreto;
  });

  test('/auth/me ya refleja two_factor_activo = true', async () => {
    const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenUsuario2FA}`);
    expect(respuesta.body.usuario.two_factor_activo).toBe(true);
  });

  test('con 2FA activo, el login normal ya NO regresa tokens directamente, sino un desafío', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({ correo: correoUsuario2FA, password: PASSWORD });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.requiere_2fa).toBe(true);
    expect(respuesta.body.desafio_2fa).toEqual(expect.any(String));
    expect(respuesta.body).not.toHaveProperty('access_token');
    global.__desafio2FA = respuesta.body.desafio_2fa;
  });

  test('completar el login con un código 2FA incorrecto responde 401', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login-2fa')
      .send({ desafio_2fa: global.__desafio2FA, codigo: '111111' });
    expect(respuesta.status).toBe(401);
  });

  test('completar el login con el código correcto sí entrega tokens', async () => {
    const codigoValido = authenticator.generate(global.__secreto2FA);
    const respuesta = await request(app)
      .post('/api/auth/login-2fa')
      .send({ desafio_2fa: global.__desafio2FA, codigo: codigoValido });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('access_token');
    expect(respuesta.body.usuario.correo).toBe(correoUsuario2FA);
  });

  test('desactivar 2FA con código inválido responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${tokenUsuario2FA}`)
      .send({ codigo: '000000' });
    expect(respuesta.status).toBe(400);
  });

  test('desactivar 2FA con el código correcto responde 200 y el siguiente login ya no lo pide', async () => {
    // El código del login anterior ya se consumió (anti-replay): se simula que
    // pasó la siguiente ventana de 30 s, como le ocurriría a un usuario real.
    const ahora = Date.now();
    const reloj = jest.spyOn(Date, 'now').mockReturnValue(ahora + 31_000);
    const codigoValido = authenticator.generate(global.__secreto2FA);
    const desactivar = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${tokenUsuario2FA}`)
      .send({ codigo: codigoValido });
    reloj.mockRestore();
    expect(desactivar.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ correo: correoUsuario2FA, password: PASSWORD });
    expect(login.body.requiere_2fa).toBeFalsy();
    expect(login.body).toHaveProperty('access_token');
  });
});
