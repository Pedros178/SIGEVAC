const { app, request, loginComoAdmin } = require('./helpers');

describe('Reportes exportables (Módulo 15)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'ReporteTest', apellidoPaterno: 'Mayor', fechaNacimiento: '1990-01-01' });
  });

  test('GET /api/reportes/tipos lista los tipos de reporte disponibles', async () => {
    const respuesta = await request(app).get('/api/reportes/tipos').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tipos).toContain('mayores');
    expect(respuesta.body.tipos).toContain('menores');
  });

  test('un reporte en formato json devuelve columnas y filas', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/mayores')
      .query({ formato: 'json' })
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('columnas');
    expect(respuesta.body).toHaveProperty('filas');
    expect(respuesta.body.filas.some((f) => f.nombre && f.nombre.includes('ReporteTest'))).toBe(true);
  });

  test('un reporte en formato csv responde con content-type text/csv', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/mayores')
      .query({ formato: 'csv' })
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/text\/csv/);
  });

  test('un tipo de reporte inexistente responde 404', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/no-existe')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });

  test('reportes sin autenticación responde 401', async () => {
    const respuesta = await request(app).get('/api/reportes/mayores');
    expect(respuesta.status).toBe(401);
  });
});

describe('Dashboard (Módulo 16)', () => {
  test('devuelve los indicadores esperados con al menos un voluntario registrado', async () => {
    const admin = await loginComoAdmin();
    const respuesta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${admin.access_token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.indicadores.total_voluntarios).toBeGreaterThan(0);
    expect(respuesta.body.indicadores).toHaveProperty('documentos_faltantes');
  });
});
