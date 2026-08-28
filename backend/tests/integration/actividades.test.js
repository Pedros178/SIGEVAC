const { app, request, loginComoAdmin } = require('./helpers');

describe('Actividades, participación y horas de servicio (Módulos 10-14)', () => {
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
      .send({ nombre: 'Renata', apellidoPaterno: 'Cruz', fechaNacimiento: '1997-08-08' });
    voluntarioId = alta.body.voluntario.id;

    const actividad = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Taller de pruebas Jest', fecha: '2026-09-01', lugar: 'Sede', cupo: 10 });
    actividadId = actividad.body.actividad.id;
  });

  test('inscribir un voluntario a una actividad crea la participación', async () => {
    const respuesta = await request(app)
      .post(`/api/actividades/${actividadId}/participaciones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voluntarioId });
    expect(respuesta.status).toBe(201);
    participacionId = respuesta.body.participacion.id;
    expect(respuesta.body.participacion.voluntario_id).toBe(voluntarioId);
  });

  test('inscribir dos veces al mismo voluntario a la misma actividad responde 409', async () => {
    const respuesta = await request(app)
      .post(`/api/actividades/${actividadId}/participaciones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voluntarioId });
    expect(respuesta.status).toBe(409);
  });

  test('registrar entrada y salida calcula horas realizadas y las acumula', async () => {
    const entrada = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(entrada.status).toBe(200);

    const salida = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(salida.status).toBe(200);
    expect(salida.body.asistencia).toHaveProperty('horas_realizadas');
    expect(Number(salida.body.asistencia.horas_realizadas)).toBeGreaterThanOrEqual(0);

    const horas = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/horas-servicio`)
      .set('Authorization', `Bearer ${token}`);
    expect(horas.status).toBe(200);
    expect(horas.body).toHaveProperty('total_horas');
  });

  test('registrar salida dos veces para la misma participación falla', async () => {
    const respuesta = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(respuesta.status).toBeGreaterThanOrEqual(400);
  });

  test('generar una credencial digital devuelve folio, vigencia y una imagen QR en base64', async () => {
    const respuesta = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/credencial`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.credencial).toHaveProperty('qr_codigo');
    expect(respuesta.body.credencial.qr_imagen).toMatch(/^data:image\/png;base64,/);
  });

  test('validar identidad por código QR devuelve los datos del voluntario correcto', async () => {
    const credencial = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/credencial`)
      .set('Authorization', `Bearer ${token}`);
    const codigo = credencial.body.credencial.qr_codigo;

    const validacion = await request(app)
      .get(`/api/qr/${codigo}`)
      .set('Authorization', `Bearer ${token}`);
    expect(validacion.status).toBe(200);
    expect(validacion.body.voluntario.id).toBe(voluntarioId);
  });
});

describe('Evidencias fotográficas de actividades (bug real: se subían pero nunca se podían volver a ver)', () => {
  // 1x1 PNG válido en base64, mínimo posible: antes de este bug fix, ni
  // siquiera hacía falta que fuera una imagen real (nunca se leía de
  // vuelta), pero ahora sí importa porque se sirve y se compara el
  // contenido byte a byte.
  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );

  let token;
  let actividadId;
  let evidenciaId;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;

    const creada = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Actividad con evidencia ${Date.now()}`, fecha: '2026-09-15', lugar: 'Sede' });
    actividadId = creada.body.actividad.id;
  });

  test('subir una evidencia fotográfica responde 201', async () => {
    const subida = await request(app)
      .post(`/api/actividades/${actividadId}/evidencias`)
      .set('Authorization', `Bearer ${token}`)
      .attach('evidencia', PNG_1X1, { filename: 'evento.png', contentType: 'image/png' })
      .field('descripcion', 'Foto del grupo antes de iniciar');

    expect(subida.status).toBe(201);
    expect(subida.body.evidencia.mime_type).toBe('image/png');
    evidenciaId = subida.body.evidencia.id;
  });

  test('la evidencia aparece en el detalle de la actividad', async () => {
    const detalle = await request(app)
      .get(`/api/actividades/${actividadId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detalle.body.actividad.evidencias.some((e) => e.id === evidenciaId)).toBe(true);
  });

  test('GET /api/evidencias/:id devuelve la imagen real con el content-type correcto', async () => {
    const respuesta = await request(app)
      .get(`/api/evidencias/${evidenciaId}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(respuesta.body, PNG_1X1)).toBe(0); // bytes idénticos a los subidos
  });

  test('sin autenticación, ver una evidencia responde 401', async () => {
    const respuesta = await request(app).get(`/api/evidencias/${evidenciaId}`);
    expect(respuesta.status).toBe(401);
  });

  test('una evidencia inexistente responde 404', async () => {
    const respuesta = await request(app)
      .get('/api/evidencias/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });
});
