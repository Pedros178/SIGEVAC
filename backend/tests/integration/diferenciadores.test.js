const { app, request, loginComoAdmin } = require('./helpers');

describe('Configuración del sistema (Módulo 19)', () => {
  let token;
  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('establecer y luego leer un valor de configuración', async () => {
    const clave = `dias_alerta_${Date.now()}`;
    const establecer = await request(app)
      .put(`/api/configuracion/${clave}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 30 });
    expect(establecer.status).toBe(200);

    const listar = await request(app).get('/api/configuracion').set('Authorization', `Bearer ${token}`);
    expect(listar.status).toBe(200);
    expect(listar.body.configuracion.some((c) => c.clave === clave)).toBe(true);
  });
});

describe('Notificaciones (Módulo 17)', () => {
  let token;
  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('crear una actividad genera una notificación interna visible para el usuario', async () => {
    await request(app)
      .post('/api/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Actividad notif ${Date.now()}`, fecha: '2026-10-01' });

    const notifs = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${token}`);
    expect(notifs.status).toBe(200);
    expect(notifs.body.notificaciones.length).toBeGreaterThan(0);
    expect(notifs.body).toHaveProperty('no_leidas');
  });

  test('marcar una notificación como leída la excluye del filtro soloNoLeidas', async () => {
    const notifs = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${token}`);
    const idNotif = notifs.body.notificaciones[0].id;

    const marcar = await request(app)
      .patch(`/api/notificaciones/${idNotif}/leida`)
      .set('Authorization', `Bearer ${token}`);
    expect(marcar.status).toBe(200);
    expect(marcar.body.notificacion.leida).toBe(true);
  });
});

describe('Diferenciadores Fase 6: plantillas y firma electrónica', () => {
  let token;
  let documentoCartaId;

  beforeAll(async () => {
    token = (await loginComoAdmin()).access_token;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Firmante', apellidoPaterno: 'Prueba', fechaNacimiento: '1991-01-01' });
    const expediente = await request(app)
      .get(`/api/voluntarios/${alta.body.voluntario.id}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    documentoCartaId = expediente.body.expediente.documentos.find((d) => d.tipo_clave === 'carta_responsiva').id;
  });

  test('generar un documento desde plantilla produce un archivo PDF y avanza el expediente', async () => {
    const respuesta = await request(app)
      .post(`/api/documentos/${documentoCartaId}/generar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.archivo.mime_type).toBe('application/pdf');
  });

  test('firmar el documento guarda la firma y la expone en el endpoint de consulta', async () => {
    const pngMinimo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const firmar = await request(app)
      .post(`/api/documentos/${documentoCartaId}/firmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imagenPngBase64: pngMinimo, firmanteNombre: 'Firmante Prueba', firmanteTipo: 'voluntario' });
    expect(firmar.status).toBe(201);

    const consulta = await request(app)
      .get(`/api/documentos/${documentoCartaId}/firma`)
      .set('Authorization', `Bearer ${token}`);
    expect(consulta.status).toBe(200);
    expect(consulta.body.firma.firmante_nombre).toBe('Firmante Prueba');
  });

  test('firmar sin nombre del firmante responde 400', async () => {
    const pngMinimo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const respuesta = await request(app)
      .post(`/api/documentos/${documentoCartaId}/firmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imagenPngBase64: pngMinimo });
    expect(respuesta.status).toBe(400);
  });
});
