const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, request, loginComoAdmin } = require('./helpers');
const { generarTokenPortal } = require('../../src/utils/jwt');

describe('Portal del voluntario/tutor (Fase 6 - diferenciador)', () => {
  let token;
  let voluntarioAId;
  let voluntarioBId;
  let tokenPortalA;
  const archivoPrueba = path.join(os.tmpdir(), 'portal_prueba_jest.pdf');

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    fs.writeFileSync(archivoPrueba, '%PDF-1.4 archivo de prueba del portal');

    const altaA = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Portal A', apellidoPaterno: 'Uno', fechaNacimiento: '1993-03-03', correo: `portalA.${Date.now()}@example.com` });
    voluntarioAId = altaA.body.voluntario.id;

    const altaB = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Portal B', apellidoPaterno: 'Dos', fechaNacimiento: '1994-04-04', correo: `portalB.${Date.now()}@example.com` });
    voluntarioBId = altaB.body.voluntario.id;

    // Generamos el token de portal directamente (en producción llegaría por correo vía "enlace mágico")
    tokenPortalA = generarTokenPortal(voluntarioAId);
  });

  afterAll(() => {
    if (fs.existsSync(archivoPrueba)) fs.unlinkSync(archivoPrueba);
  });

  test('solicitar-acceso siempre responde 200, exista o no el correo (no filtra información)', async () => {
    const respuesta = await request(app)
      .post('/api/portal/solicitar-acceso')
      .send({ correo: 'correo-que-no-existe@example.com' });
    expect(respuesta.status).toBe(200);
  });

  test('sin token de portal, consultar el expediente propio responde 401', async () => {
    const respuesta = await request(app).get('/api/portal/expediente');
    expect(respuesta.status).toBe(401);
  });

  test('un access token normal del sistema NO sirve como token de portal', async () => {
    const respuesta = await request(app)
      .get('/api/portal/expediente')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(401);
  });

  test('con el token de portal correcto, el voluntario ve SU PROPIO expediente', async () => {
    const respuesta = await request(app)
      .get('/api/portal/expediente')
      .set('Authorization', `Bearer ${tokenPortalA}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.voluntario.id).toBe(voluntarioAId);
  });

  test('CRÍTICO: el voluntario A no puede subir un documento al expediente del voluntario B', async () => {
    const expedienteB = await request(app)
      .get(`/api/voluntarios/${voluntarioBId}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    const documentoDeB = expedienteB.body.expediente.documentos[0].id;

    const intento = await request(app)
      .post(`/api/portal/documentos/${documentoDeB}/archivos`)
      .set('Authorization', `Bearer ${tokenPortalA}`)
      .attach('archivo', archivoPrueba, { contentType: 'application/pdf' });

    expect(intento.status).toBe(403);
  });

  test('el voluntario A SÍ puede subir un documento a su propio expediente', async () => {
    const expedienteA = await request(app)
      .get(`/api/voluntarios/${voluntarioAId}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    const documentoDeA = expedienteA.body.expediente.documentos[0].id;

    const subida = await request(app)
      .post(`/api/portal/documentos/${documentoDeA}/archivos`)
      .set('Authorization', `Bearer ${tokenPortalA}`)
      .attach('archivo', archivoPrueba, { contentType: 'application/pdf' });

    expect(subida.status).toBe(201);
  });
});
