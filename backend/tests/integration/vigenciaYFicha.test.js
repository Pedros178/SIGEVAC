const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, request, loginComoAdmin } = require('./helpers');

/**
 * Cubre las funciones agregadas después de la suite original: alertas de
 * vigencia de documentos, la ficha del integrante (PDF/Excel) y la foto
 * de perfil del voluntario. Ninguna de estas tenía prueba alguna hasta
 * ahora — se agregan aquí para no dejarlas sin verificar.
 */
describe('Alertas de vigencia de documentos (Módulo 17 - diferenciador)', () => {
  let token;

  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('POST /api/configuracion/vigencias/revisar corre sin error y regresa un resumen', async () => {
    const respuesta = await request(app)
      .post('/api/configuracion/vigencias/revisar')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultado).toHaveProperty('documentos_revisados');
    expect(respuesta.body.resultado).toHaveProperty('notificados');
  }, 20000);

  test('un rol sin permiso de configuración no puede disparar la revisión (403)', async () => {
    const correo = `consulta.vigencia.${Date.now()}@sigevac.local`;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Consulta Vigencia', correo, password: 'Consulta#123', rol: 'consulta' });
    const login = await request(app).post('/api/auth/login').send({ correo, password: 'Consulta#123' });

    const respuesta = await request(app)
      .post('/api/configuracion/vigencias/revisar')
      .set('Authorization', `Bearer ${login.body.access_token}`);
    expect(respuesta.status).toBe(403);
  });
});

describe('Ficha del integrante — PDF y Excel (diferenciador)', () => {
  let token;
  let voluntarioId;

  beforeAll(async () => {
    token = (await loginComoAdmin()).access_token;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'FichaTest', apellidoPaterno: 'Prueba', fechaNacimiento: '1996-06-06' });
    voluntarioId = alta.body.voluntario.id;
  });

  test('GET /ficha.pdf responde con un PDF válido', async () => {
    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/ficha.pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/application\/pdf/);
    expect(respuesta.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('GET /ficha.xlsx responde con un Excel válido', async () => {
    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/ficha.xlsx`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.slice(0, 2).toString()).toBe('PK');
  });

  test('la ficha de un voluntario inexistente responde 404', async () => {
    const respuesta = await request(app)
      .get('/api/voluntarios/00000000-0000-0000-0000-000000000000/ficha.pdf')
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });
});

describe('Fotografía de perfil del voluntario', () => {
  let token;
  let voluntarioId;
  const imagenPrueba = path.join(os.tmpdir(), 'foto_prueba_jest.png');

  beforeAll(async () => {
    token = (await loginComoAdmin()).access_token;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'FotoTest', apellidoPaterno: 'Prueba', fechaNacimiento: '1998-08-08' });
    voluntarioId = alta.body.voluntario.id;

    // PNG de 1x1 pixel válido (el mínimo necesario para que multer/sharp lo acepten como imagen real)
    const pngMinimo = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(imagenPrueba, pngMinimo);
  });

  afterAll(() => {
    if (fs.existsSync(imagenPrueba)) fs.unlinkSync(imagenPrueba);
  });

  test('antes de subir foto, GET /foto responde 404', async () => {
    const respuesta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/foto`)
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
  });

  test('subir una fotografía la asocia al voluntario y luego se puede recuperar', async () => {
    const subida = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', imagenPrueba, { contentType: 'image/png' });
    expect(subida.status).toBe(201);
    expect(subida.body.voluntario.fotografia_url).toBeTruthy();

    const consulta = await request(app)
      .get(`/api/voluntarios/${voluntarioId}/foto`)
      .set('Authorization', `Bearer ${token}`);
    expect(consulta.status).toBe(200);
  });

  test('subir un archivo que no es imagen ni PDF responde 415 (tipo de archivo no permitido)', async () => {
    const archivoTexto = path.join(os.tmpdir(), 'no_es_imagen.txt');
    fs.writeFileSync(archivoTexto, 'esto no es una imagen');
    const respuesta = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', archivoTexto, { contentType: 'text/plain' });
    expect(respuesta.status).toBe(415);
    fs.unlinkSync(archivoTexto);
  });

  test('subir un PDF como "foto" pasa el filtro general de archivos pero lo rechaza el controlador (400)', async () => {
    const archivoPdf = path.join(os.tmpdir(), 'no_es_foto.pdf');
    fs.writeFileSync(archivoPdf, '%PDF-1.4 contenido de prueba');
    const respuesta = await request(app)
      .post(`/api/voluntarios/${voluntarioId}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', archivoPdf, { contentType: 'application/pdf' });
    expect(respuesta.status).toBe(400);
    fs.unlinkSync(archivoPdf);
  });
});
