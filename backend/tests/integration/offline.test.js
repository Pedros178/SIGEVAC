const { app, request, loginComoAdmin } = require('./helpers');

describe('Modo offline: entrada/salida sincronizadas con la hora real del dispositivo', () => {
  let token;
  let voluntarioId;
  let actividadId;

  async function crearParticipacion() {
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Diego', apellidoPaterno: 'Ramírez', fechaNacimiento: '1995-01-20' });
    voluntarioId = alta.body.voluntario.id;

    const actividad = await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Jornada offline', fecha: '2026-09-15', lugar: 'Sede' });
    actividadId = actividad.body.actividad.id;

    const inscripcion = await request(app)
      .post(`/api/actividades/${actividadId}/participaciones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voluntarioId });
    return inscripcion.body.participacion.id;
  }

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  test('sincronizar entrada y salida con horaCliente calcula las horas reales del evento, no las de sincronización', async () => {
    const participacionId = await crearParticipacion();

    // Simula: el voluntario entró hace 3 horas y salió hace 1 hora, pero el
    // dispositivo estuvo sin conexión y recién ahora sincroniza ambos eventos.
    const haceTresHoras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const haceUnaHora = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const entrada = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: haceTresHoras });
    expect(entrada.status).toBe(200);
    expect(new Date(entrada.body.asistencia.hora_entrada).toISOString()).toBe(haceTresHoras);

    const salida = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: haceUnaHora });
    expect(salida.status).toBe(200);
    // 3 horas antes -> 1 hora antes = 2 horas trabajadas, no ~0 (que sería
    // el resultado incorrecto si el backend hubiera usado el momento de
    // sincronización en vez de la hora real capturada offline).
    expect(Number(salida.body.asistencia.horas_realizadas)).toBeCloseTo(2, 1);
  });

  test('horaCliente de más de 7 días en el pasado responde 400', async () => {
    const participacionId = await crearParticipacion();
    const haceOchoDias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const respuesta = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: haceOchoDias });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/7 días/);
  });

  test('horaCliente en el futuro responde 400', async () => {
    const participacionId = await crearParticipacion();
    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const respuesta = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: enUnaHora });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/futuro/);
  });

  test('horaCliente de salida anterior a la hora de entrada responde 400', async () => {
    const participacionId = await crearParticipacion();
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: haceUnaHora });

    const salida = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: haceDosHoras }); // anterior a la entrada
    expect(salida.status).toBe(400);
    expect(salida.body.error).toMatch(/anterior a la hora de entrada/);
  });

  test('horaCliente con formato inválido responde 400', async () => {
    const participacionId = await crearParticipacion();
    const respuesta = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: 'no-es-una-fecha' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/ISO 8601/);
  });

  test('sin horaCliente, el comportamiento normal (hora del servidor) no cambia', async () => {
    const participacionId = await crearParticipacion();
    const entrada = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(entrada.status).toBe(200);
    expect(entrada.body.asistencia.hora_entrada).toBeTruthy();

    const antes = Date.now();
    const salida = await request(app)
      .post(`/api/participaciones/${participacionId}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(salida.status).toBe(200);
    expect(Math.abs(new Date(salida.body.asistencia.hora_salida).getTime() - antes)).toBeLessThan(5000);
  });

  test('registrar entrada offline dos veces (reintento de sincronización) es idempotente', async () => {
    const participacionId = await crearParticipacion();
    const hora = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const primera = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: hora });
    const segunda = await request(app)
      .post(`/api/participaciones/${participacionId}/entrada`)
      .set('Authorization', `Bearer ${token}`)
      .send({ horaCliente: hora });

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(primera.body.asistencia.hora_entrada).toBe(segunda.body.asistencia.hora_entrada);
  });
});
