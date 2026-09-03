const { app, request, loginComoAdmin } = require('./helpers');

describe('Dashboard operativo', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  test('sin autenticación responde 401', async () => {
    const respuesta = await request(app).get('/api/dashboard');
    expect(respuesta.status).toBe(401);
  });

  test('devuelve indicadores y series para visualización', async () => {
    const respuesta = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.indicadores).toEqual(expect.objectContaining({
      total_voluntarios: expect.any(Number),
      expedientes_completos: expect.any(Number),
      horas_realizadas_total: expect.any(Number),
      voluntarios_por_mes: expect.any(Array),
      horas_por_mes: expect.any(Array),
      expedientes_por_estado: expect.any(Array),
    }));
  });
});
