const { app, request, loginComoAdmin } = require('./helpers');

describe('Certificado público de horas', () => {
  let token;
  let codigo;

  beforeAll(async () => {
    token = (await loginComoAdmin()).access_token;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Certificado', apellidoPaterno: 'Publico', fechaNacimiento: '1990-01-01' });
    const credencial = await request(app)
      .post(`/api/voluntarios/${alta.body.voluntario.id}/credencial`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    codigo = credencial.body.credencial.qr_codigo;
  });

  test('permite consultar un certificado sin autenticación', async () => {
    const respuesta = await request(app).get(`/api/publico/certificados/${codigo}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.certificado).toEqual(expect.objectContaining({
      numero_voluntario: expect.stringMatching(/^SC-\d{4}-\d+$/),
      asociacion_nombre: expect.any(String),
      total_horas: expect.any(Number),
      detalle: expect.any(Array),
    }));
  });

  test('genera un PDF público verificable', async () => {
    const respuesta = await request(app).get(`/api/publico/certificados/${codigo}.pdf`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/application\/pdf/);
    expect(respuesta.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('rechaza códigos desconocidos', async () => {
    const respuesta = await request(app).get('/api/publico/certificados/codigo-inexistente');
    expect(respuesta.status).toBe(404);
  });
});
