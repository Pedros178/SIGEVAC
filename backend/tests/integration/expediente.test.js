const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, request, loginComoAdmin } = require('./helpers');

describe('Expediente digital: gestor de archivos y semáforo (Módulos 7-9)', () => {
  let token;
  let voluntarioId;
  let documentoCurpId;
  const archivoPrueba = path.join(os.tmpdir(), 'curp_prueba_jest.pdf');

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    fs.writeFileSync(archivoPrueba, '%PDF-1.4 contenido de prueba para Jest');

    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Diego', apellidoPaterno: 'Vargas', fechaNacimiento: '1992-02-02' });
    voluntarioId = alta.body.voluntario.id;

    const expediente = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    documentoCurpId = expediente.body.expediente.documentos.find((d) => d.tipo_clave === 'curp').id;
  });

  afterAll(() => {
    if (fs.existsSync(archivoPrueba)) fs.unlinkSync(archivoPrueba);
  });

  test('el expediente recién creado inicia en estado "incompleto" con 0% de avance', async () => {
    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.body.expediente.estado).toBe('incompleto');
    expect(respuesta.body.expediente.porcentaje_avance).toBe(0);
  });

  test('subir un archivo cambia el documento a "cargado" y el expediente a "en_revision"', async () => {
    const subida = await request(app)
      .post(`/api/documentos/${documentoCurpId}/archivos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', archivoPrueba, { contentType: 'application/pdf' });

    expect(subida.status).toBe(201);

    const expediente = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    expect(expediente.body.expediente.estado).toBe('en_revision');
    const doc = expediente.body.expediente.documentos.find((d) => d.id === documentoCurpId);
    expect(doc.estado).toBe('cargado');
  });

  test('aprobar el documento incrementa el porcentaje de avance del expediente', async () => {
    const aprobar = await request(app)
      .post(`/api/documentos/${documentoCurpId}/aprobar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(aprobar.status).toBe(200);
    expect(aprobar.body.documento.estado).toBe('aprobado');
    expect(aprobar.body.expediente.porcentaje_avance).toBeGreaterThan(0);
  });

  test('rechazar un documento sin motivo responde 400', async () => {
    const respuesta = await request(app)
      .post(`/api/documentos/${documentoCurpId}/rechazar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(respuesta.status).toBe(400);
  });

  test('descargar un archivo sin autenticación responde 401', async () => {
    const listado = await request(app)
      .get(`/api/documentos/${documentoCurpId}/archivos`)
      .set('Authorization', `Bearer ${token}`);
    const archivoId = listado.body.archivos[0].id;

    const respuesta = await request(app).get(`/api/archivos/${archivoId}/descargar`);
    expect(respuesta.status).toBe(401);
  });
});
