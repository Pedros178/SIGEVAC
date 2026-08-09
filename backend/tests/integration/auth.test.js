const { app, request, loginComoAdmin, CORREO_ADMIN } = require('./helpers');

describe('POST /api/auth/login', () => {
  test('con credenciales correctas devuelve tokens y datos del usuario', async () => {
    const body = await loginComoAdmin();
    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
    expect(body.usuario.correo).toBe(CORREO_ADMIN);
    expect(body.usuario.roles.some((r) => r.nombre === 'super_admin')).toBe(true);
  });

  test('con contraseña incorrecta responde 401', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: CORREO_ADMIN, password: 'contraseña-incorrecta' });
    expect(respuesta.status).toBe(401);
  });

  test('con un correo inexistente responde 401 (sin revelar si el correo existe)', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'no-existe@sigevac.local', password: 'lo-que-sea' });
    expect(respuesta.status).toBe(401);
  });

  test('sin correo ni contraseña responde 400', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({});
    expect(respuesta.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  test('sin token responde 401', async () => {
    const respuesta = await request(app).get('/api/auth/me');
    expect(respuesta.status).toBe(401);
  });

  test('con un access token válido devuelve los datos del usuario autenticado', async () => {
    const { access_token: token } = await loginComoAdmin();
    const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.correo).toBe(CORREO_ADMIN);
  });

  test('con un token manipulado responde 401', async () => {
    const { access_token: token } = await loginComoAdmin();
    const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}xx`);
    expect(respuesta.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  test('con un refresh token válido devuelve un nuevo access token', async () => {
    const { refresh_token: refreshToken } = await loginComoAdmin();
    const respuesta = await request(app).post('/api/auth/refresh').send({ refresh_token: refreshToken });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('access_token');
  });
});

describe('Cualquier ruta protegida sin autenticación', () => {
  test('GET /api/voluntarios sin token responde 401', async () => {
    const respuesta = await request(app).get('/api/voluntarios');
    expect(respuesta.status).toBe(401);
  });
});
