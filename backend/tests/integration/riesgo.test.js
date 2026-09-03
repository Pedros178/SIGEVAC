const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

describe('Modelo de riesgo de abandono (scoring por reglas ponderadas)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  async function crearVoluntario(nombre) {
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre, apellidoPaterno: 'Riesgo', fechaNacimiento: '1998-05-10' });
    return alta.body.voluntario.id;
  }

  /** Inserta una asistencia completada con hora_salida en el pasado, sin depender del flujo real de entrada/salida. */
  async function simularActividadCompletada(voluntarioId, hace) {
    const actividad = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Actividad histórica ${Date.now()}-${Math.random()}`, fecha: '2026-01-01', lugar: 'Sede' });
    const inscripcion = await request(app)
      .post(`/api/actividades/${actividad.body.actividad.id}/participaciones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voluntarioId });
    const participacionId = inscripcion.body.participacion.id;

    await query(
      `INSERT INTO asistencias (participacion_id, hora_entrada, hora_salida, horas_realizadas)
       VALUES ($1, $2, $2, 3)`,
      [participacionId, hace]
    );
  }

  test('un voluntario recién creado (sin historial) tiene riesgo bajo, con expediente incompleto y compromiso inicial como factores', async () => {
    const voluntarioId = await crearVoluntario('Recién Llegada');

    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/riesgo`)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.nivel).toBe('bajo');
    const criterios = respuesta.body.desglose.map((d) => d.criterio);
    expect(criterios).toEqual(expect.arrayContaining(['expediente_documentacion', 'compromiso_inicial']));
  });

  test('un voluntario con antigüedad y sin actividad reciente sube a riesgo alto por inactividad', async () => {
    const voluntarioId = await crearVoluntario('Antigua Inactiva');
    // Se le da 200 días de antigüedad directamente en la BD (equivalente a un voluntario veterano).
    await query(`UPDATE voluntarios SET fecha_ingreso = CURRENT_DATE - INTERVAL '200 days' WHERE id = $1`, [voluntarioId]);
    // Su única actividad fue hace 100 días.
    await simularActividadCompletada(voluntarioId, new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString());

    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/riesgo`)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.puntaje).toBeGreaterThanOrEqual(40); // al menos el máximo de inactividad
    expect(respuesta.body.desglose[0].criterio).toBe('inactividad_reciente'); // debe ser el factor principal
  });

  test('un voluntario activo recientemente tiene un puntaje notablemente menor que uno inactivo', async () => {
    const voluntarioActivoId = await crearVoluntario('Muy Activa');
    await query(`UPDATE voluntarios SET fecha_ingreso = CURRENT_DATE - INTERVAL '200 days' WHERE id = $1`, [voluntarioActivoId]);
    await simularActividadCompletada(voluntarioActivoId, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
    // Aprobamos su expediente para aislar el efecto de la actividad reciente.
    await query(`UPDATE expedientes SET porcentaje_avance = 100 WHERE voluntario_id = $1`, [voluntarioActivoId]);

    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioActivoId}/riesgo`)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.puntaje).toBe(0);
    expect(respuesta.body.nivel).toBe('bajo');
  });

  test('un documento vencido aparece reflejado en el puntaje', async () => {
    const voluntarioId = await crearVoluntario('Con Documento Vencido');
    await query(`UPDATE expedientes SET porcentaje_avance = 100 WHERE voluntario_id = $1`, [voluntarioId]);

    const { rows: expedienteRows } = await query(`SELECT id FROM expedientes WHERE voluntario_id = $1`, [voluntarioId]);
    await query(
      `UPDATE documentos SET estado = 'aprobado', vigencia_hasta = CURRENT_DATE - INTERVAL '10 days'
       WHERE expediente_id = $1 AND id = (SELECT id FROM documentos WHERE expediente_id = $1 LIMIT 1)`,
      [expedienteRows[0].id]
    );

    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/riesgo`)
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.body.desglose.find((d) => d.criterio === 'expediente_documentacion').etiqueta).toMatch(/documentación vencida/);
  });

  test('un voluntario inexistente responde 404', async () => {
    const respuesta = await request(app)
      .get('/api/voluntarios/00000000-0000-0000-0000-000000000000/riesgo')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });

  test('el resumen de la asociación incluye a todos los voluntarios activos, ordenados de mayor a menor riesgo', async () => {
    await crearVoluntario('Para Resumen A');
    await crearVoluntario('Para Resumen B');

    const respuesta = await request(app)
      .get('/api/voluntarios/riesgo/resumen')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.voluntarios.length).toBeGreaterThanOrEqual(2);
    expect(respuesta.body.resumen).toHaveProperty('alto');
    expect(respuesta.body.resumen).toHaveProperty('medio');
    expect(respuesta.body.resumen).toHaveProperty('bajo');

    const puntajes = respuesta.body.voluntarios.map((v) => v.puntaje);
    expect(puntajes).toEqual([...puntajes].sort((a, b) => b - a));
  });

  test('el resumen no incluye voluntarios dados de baja', async () => {
    const voluntarioId = await crearVoluntario('Dada De Baja');
    await request(app)
      .delete(`/api/voluntarios/${voluntarioId}`)
      .set('Authorization', `Bearer ${token}`);

    const respuesta = await request(app)
      .get('/api/voluntarios/riesgo/resumen')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.body.voluntarios.find((v) => v.voluntario_id === voluntarioId)).toBeUndefined();
  });

  test('el reporte "voluntarios-en-riesgo" está disponible en el catálogo de reportes y se puede generar', async () => {
    const tipos = await request(app)
      .get('/api/reportes/tipos')
      .set('Authorization', `Bearer ${token}`);
    expect(tipos.body.tipos).toContain('voluntarios-en-riesgo');

    const reporte = await request(app)
      .get('/api/reportes/voluntarios-en-riesgo')
      .set('Authorization', `Bearer ${token}`);
    expect(reporte.status).toBe(200);
    expect(reporte.body.titulo).toBe('Voluntarios en riesgo de abandono');
    expect(Array.isArray(reporte.body.filas)).toBe(true);
  });

  test('sin autenticación, tanto el detalle como el resumen responden 401', async () => {
    const detalle = await request(app).get('/api/voluntarios/riesgo/resumen');
    expect(detalle.status).toBe(401);
  });
});
