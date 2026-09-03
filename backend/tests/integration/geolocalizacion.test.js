const { app, request, loginComoAdmin } = require('./helpers');

describe('Geolocalización de actividades (mapa interactivo)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  test('crear una actividad con latitud/longitud válidas las guarda correctamente', async () => {
    const respuesta = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada con ubicación', fecha: '2026-09-10', lugar: 'Parque Juárez', latitud: 18.4655, longitud: -97.3928 });
    expect(respuesta.status).toBe(201);
    expect(Number(respuesta.body.actividad.latitud)).toBeCloseTo(18.4655);
    expect(Number(respuesta.body.actividad.longitud)).toBeCloseTo(-97.3928);
  });

  test('crear una actividad sin coordenadas las deja en null (siguen siendo opcionales)', async () => {
    const respuesta = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada sin ubicación', fecha: '2026-09-11' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.actividad.latitud).toBeNull();
    expect(respuesta.body.actividad.longitud).toBeNull();
  });

  test('mandar solo latitud sin longitud responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada incompleta', fecha: '2026-09-12', latitud: 18.4655 });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/latitud y longitud/i);
  });

  test('coordenadas fuera de rango responden 400', async () => {
    const respuesta = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada inválida', fecha: '2026-09-13', latitud: 200, longitud: -97.39 });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/-90 y 90/);
  });

  test('actualizar una actividad para agregarle coordenadas después funciona', async () => {
    const creada = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada a ubicar después', fecha: '2026-09-14' });

    const actualizada = await request(app)
      .put(`/api/actividades/${creada.body.actividad.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitud: 19.4326, longitud: -99.1332 });
    expect(actualizada.status).toBe(200);
    expect(Number(actualizada.body.actividad.latitud)).toBeCloseTo(19.4326);
  });

  test('el listado de actividades incluye latitud y longitud para dibujar el mapa', async () => {
    const respuesta = await request(app)
      .get('/api/actividades')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    const conUbicacion = respuesta.body.actividades.find((a) => a.nombre === 'Jornada con ubicación');
    expect(conUbicacion).toHaveProperty('latitud');
    expect(conUbicacion).toHaveProperty('longitud');
  });
});
