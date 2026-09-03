const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

describe('Gamificación: insignias por horas, actividades, antigüedad y racha', () => {
  let token;
  let voluntarioId;
  let actividadId;
  let participacionId;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;

    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Ximena', apellidoPaterno: 'Torres', fechaNacimiento: '1999-03-12' });
    voluntarioId = alta.body.voluntario.id;

    const actividad = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada de gamificación', fecha: '2026-09-05', lugar: 'Sede' });
    actividadId = actividad.body.actividad.id;
  });

  test('el catálogo de insignias incluye las insignias base con sus criterios', async () => {
    const respuesta = await request(app)
      .get('/api/insignias')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.insignias)).toBe(true);
    const claves = respuesta.body.insignias.map((i) => i.clave);
    expect(claves).toEqual(expect.arrayContaining(['primeros_pasos', 'comprometido_10h', 'leyenda_100h']));
  });

  test('un voluntario sin actividad completada no tiene insignias y su nivel es bronce', async () => {
    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/insignias`)
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.insignias).toHaveLength(0);
    expect(respuesta.body.nivel.clave).toBe('bronce');
  });

  test('completar una actividad otorga automáticamente la insignia "primeros_pasos"', async () => {
    const inscripcion = await request(app)
      .post(`/api/actividades/${actividadId}/participaciones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voluntarioId });
    participacionId = inscripcion.body.participacion.id;

    await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const salida = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(salida.status).toBe(200);
    expect(salida.body.nuevas_insignias.map((i) => i.clave)).toContain('primeros_pasos');

    const insignias = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/insignias`)
      .set('Authorization', `Bearer ${token}`);
    expect(insignias.body.insignias.map((i) => i.clave)).toContain('primeros_pasos');
    expect(insignias.body.metricas.actividades_completadas).toBe(1);
  });

  test('otorgar la misma insignia dos veces no duplica el registro (idempotente)', async () => {
    const primera = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/insignias/recalcular`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    // Ya se otorgó en el test anterior, así que aquí no debe volver a aparecer como "nueva".
    expect(primera.body.nuevas_insignias.map((i) => i.clave)).not.toContain('primeros_pasos');

    const insignias = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/insignias`)
      .set('Authorization', `Bearer ${token}`);
    const veces = insignias.body.insignias.filter((i) => i.clave === 'primeros_pasos').length;
    expect(veces).toBe(1);
  });

  test('acumular 10+ horas sube el nivel a "plata" y otorga la insignia de horas', async () => {
    // Se simulan horas históricas directo en la tabla (equivalente a varias
    // salidas reales) para no depender de esperar tiempo real en la prueba.
    await query(
      `INSERT INTO horas_servicio (voluntario_id, tipo, periodo, horas_acumuladas)
       VALUES ($1, 'voluntariado', to_char(now(), 'YYYY-MM'), 25)
       ON CONFLICT (voluntario_id, tipo, periodo)
       DO UPDATE SET horas_acumuladas = horas_servicio.horas_acumuladas + EXCLUDED.horas_acumuladas`,
      [voluntarioId]
    );

    const recalculo = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/insignias/recalcular`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(recalculo.body.nuevas_insignias.map((i) => i.clave)).toContain('comprometido_10h');

    const insignias = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/insignias`)
      .set('Authorization', `Bearer ${token}`);
    expect(insignias.body.nivel.clave).toBe('plata');
    expect(insignias.body.nivel.siguiente_nivel.etiqueta).toBe('Oro');
  });

  test('un voluntario inexistente responde 404 (protegido por aislamiento de asociación)', async () => {
    const respuesta = await request(app)
      .get('/api/voluntarios/00000000-0000-0000-0000-000000000000/insignias')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });

  test('sin autenticación, ver el catálogo de insignias responde 401', async () => {
    const respuesta = await request(app).get('/api/insignias');
    expect(respuesta.status).toBe(401);
  });
});
