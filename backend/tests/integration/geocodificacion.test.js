const { app, request, loginComoAdmin } = require('./helpers');

describe('Proxy de geocodificación (/api/geocodificacion)', () => {
  let token;
  let fetchOriginal;

  beforeAll(async () => {
    ({ access_token: token } = await loginComoAdmin());
  });

  beforeEach(() => {
    fetchOriginal = global.fetch;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  test('rechaza la búsqueda sin sesión (no es un geocodificador público)', async () => {
    const respuesta = await request(app).get('/api/geocodificacion/buscar?q=Tehuacan');
    expect(respuesta.status).toBe(401);
  });

  test('exige al menos 3 caracteres', async () => {
    const respuesta = await request(app)
      .get('/api/geocodificacion/buscar?q=ab')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(400);
  });

  test('devuelve los lugares encontrados', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([{ place_id: 7, display_name: 'Tehuacán, Puebla', lat: '18.46', lon: '-97.39' }]),
    });

    const respuesta = await request(app)
      .get('/api/geocodificacion/buscar?q=Tehuacan Puebla centro')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.lugares[0].display_name).toBe('Tehuacán, Puebla');
  });

  test('responde 503 (no 500) cuando Nominatim limita las peticiones', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    const respuesta = await request(app)
      .get('/api/geocodificacion/buscar?q=Puebla capital centro historico')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(503);
  });

  test('geocodificación inversa requiere lat y lon', async () => {
    const respuesta = await request(app)
      .get('/api/geocodificacion/inverso?lat=18.46')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(400);
  });
});
