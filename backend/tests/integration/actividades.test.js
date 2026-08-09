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
