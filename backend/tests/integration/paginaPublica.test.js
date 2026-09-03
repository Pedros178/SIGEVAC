const { app, request, loginComoAdmin } = require('./helpers');

describe('GET /api/publico/actividades (página de inicio, sin autenticación)', () => {
  test('responde 200 sin token', async () => {
    const respuesta = await request(app).get('/api/publico/actividades');
    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.actividades)).toBe(true);
  });

  test('una actividad futura recién creada aparece, con solo campos públicos', async () => {
    const { access_token: token } = await loginComoAdmin();
    // Se usa "mañana" (no una fecha fija lejana) para que, sin importar
    // cuántas otras actividades futuras haya creado otro archivo de test
    // en esta misma suite, esta sea de las más próximas y no quede fuera
    // del LIMIT del endpoint público.
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const creada = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Actividad pública ${Date.now()}`, fecha: manana, lugar: 'Plaza principal' });
    expect(creada.status).toBe(201);

    const respuesta = await request(app).get('/api/publico/actividades');
    const publica = respuesta.body.actividades.find((a) => a.id === creada.body.actividad.id);
    expect(publica).toBeDefined();
    expect(publica.nombre).toBe(creada.body.actividad.nombre);
    // Nunca debe filtrar datos internos como el responsable o el total de inscritos.
    expect(publica).not.toHaveProperty('responsable_id');
    expect(publica).not.toHaveProperty('responsable_nombre');
    expect(publica).not.toHaveProperty('total_inscritos');
    expect(publica).not.toHaveProperty('creado_en');
  });

  test('una actividad ya pasada no aparece en la lista pública', async () => {
    const { access_token: token } = await loginComoAdmin();
    const creada = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Actividad pasada ${Date.now()}`, fecha: '2020-01-01', lugar: 'Sede' });
    expect(creada.status).toBe(201);

    const respuesta = await request(app).get('/api/publico/actividades');
    expect(respuesta.body.actividades.find((a) => a.id === creada.body.actividad.id)).toBeUndefined();
  });

  test('nunca devuelve más de 6 actividades', async () => {
    const respuesta = await request(app).get('/api/publico/actividades');
    expect(respuesta.body.actividades.length).toBeLessThanOrEqual(6);
  });
});
