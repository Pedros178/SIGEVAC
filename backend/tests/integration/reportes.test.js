const { app, request, loginComoAdmin } = require('./helpers');

describe('Reportes exportables (Módulo 15)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'ReporteTest', apellidoPaterno: 'Mayor', fechaNacimiento: '1990-01-01',
        telefonoCelular: '5551234567', telefonoFijo: '5557654321',
        estado: 'Puebla', municipio: 'Tehuacán',
      });
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

  test('el reporte de voluntarios activos incluye edad y teléfono', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/voluntarios-activos')
      .query({ formato: 'json' })
      .set('Authorization', `Bearer ${token}`);
    const fila = respuesta.body.filas.find((f) => f.nombre && f.nombre.includes('ReporteTest'));

    expect(respuesta.status).toBe(200);
    expect(fila).toBeDefined();
    expect(fila.edad).toBe(36);
    expect(fila.telefono).toBe('5551234567');
  });

  test('un reporte en formato csv responde con content-type text/csv', async () => {
    const respuesta = await request(app)
      .get('/api/reportes/mayores')
      .query({ formato: 'csv' })
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/text\/csv/);
  });

  test('los reportes de mayores y municipio muestran los datos disponibles', async () => {
    const [mayores, municipios] = await Promise.all([
      request(app).get('/api/reportes/mayores').query({ formato: 'json' }).set('Authorization', `Bearer ${token}`),
      request(app).get('/api/reportes/voluntarios-por-municipio').query({ formato: 'json' }).set('Authorization', `Bearer ${token}`),
    ]);
    const filaMayor = mayores.body.filas.find((f) => f.nombre && f.nombre.includes('ReporteTest'));

    expect(mayores.status).toBe(200);
    expect(filaMayor.telefono).toBe('5551234567');
    expect(municipios.status).toBe(200);
    expect(municipios.body.filas).toEqual(expect.arrayContaining([{ municipio: 'Tehuacán', total: expect.any(Number) }]));
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
