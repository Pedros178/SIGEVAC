const { app, request, loginComoAdmin, CORREO_ADMIN } = require('./helpers');

describe('POST /api/auth/login', () => {
  test('con credenciales correctas devuelve access token, cookie de refresh httpOnly y datos del usuario', async () => {
    const { access_token: token, agent, usuario } = await loginComoAdmin();
    expect(token).toEqual(expect.any(String));
    // El refresh token ya NO viaja en el cuerpo de la respuesta (revisión de
    // seguridad): solo como cookie httpOnly, inaccesible desde JavaScript.
    expect(usuario.correo).toBe(CORREO_ADMIN);
    expect(usuario.roles.some((r) => r.nombre === 'super_admin')).toBe(true);

    // Verificamos que la sesión realmente quedó activa vía la cookie que
    // `agent` acaba de guardar, pidiendo un refresh sin volver a autenticar.
    const respuestaRefresh = await agent.post('/api/auth/refresh').send();
    expect(respuestaRefresh.status).toBe(200);
    expect(respuestaRefresh.body).toHaveProperty('access_token');
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
  test('con la cookie httpOnly de refresh presente devuelve un nuevo access token', async () => {
    const { agent } = await loginComoAdmin();
    const respuesta = await agent.post('/api/auth/refresh').send();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('access_token');
  });

  test('sin cookie de refresh responde 401', async () => {
    const respuesta = await request(app).post('/api/auth/refresh').send();
    expect(respuesta.status).toBe(401);
  });

  test('enviar el refresh token en el cuerpo (en vez de como cookie) ya no funciona', async () => {
    const { access_token: token } = await loginComoAdmin();
    // Un cliente que intente el flujo viejo (mandar el token en el body)
    // sin la cookie httpOnly no debe poder refrescar la sesión.
    const respuesta = await request(app).post('/api/auth/refresh').send({ refresh_token: token });
    expect(respuesta.status).toBe(401);
  });
});

describe('Cualquier ruta protegida sin autenticación', () => {
  test('GET /api/voluntarios sin token responde 401', async () => {
    const respuesta = await request(app).get('/api/voluntarios');
    expect(respuesta.status).toBe(401);
  });
});
