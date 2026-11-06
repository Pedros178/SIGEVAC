const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

// "Hoy" según la base de datos (la que usa CURRENT_DATE en la consulta pública), no según UTC: de noche, en zonas
// horarias detrás de UTC (México), la fecha UTC ya es la de mañana y la prueba calcularía mal ayer/mañana.
async function fechaBD(diasDesdeHoy) {
  const { rows } = await query(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [diasDesdeHoy]);
  return rows[0].f;
}

describe('Galería pública administrable (subir/editar/ocultar/eliminar fotos del Home)', () => {
  let token;
  const imagenPrueba = path.join(os.tmpdir(), 'galeria_prueba_jest.jpg');

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    // JPEG mínimo válido (cabecera SOI + APP0 + EOI): suficiente para que
    // el chequeo de bytes mágicos (middlewares/validarArchivo.js) lo
    // reconozca como una imagen real, sin necesitar un archivo grande.
    fs.writeFileSync(imagenPrueba, Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]));
  });

  afterAll(() => { fs.unlinkSync(imagenPrueba); });

  test('sin autenticación, la administración de galería responde 401', async () => {
    const respuesta = await request(app).get('/api/galeria');
    expect(respuesta.status).toBe(401);
  });

  test('subir una foto exige leyenda y texto_alternativo', async () => {
    const respuesta = await request(app)
      .post('/api/galeria')
      .set('Authorization', `Bearer ${token}`)
      .attach('imagen', imagenPrueba, { contentType: 'image/jpeg' })
      .field('texto_alternativo', 'Solo el texto alternativo, sin leyenda');
    expect(respuesta.status).toBe(400);
  });

  test('subir un archivo que no es una imagen real (bytes falsos) se rechaza', async () => {
    const archivoFalso = path.join(os.tmpdir(), 'no_es_imagen_jest.txt');
    fs.writeFileSync(archivoFalso, 'esto no es una imagen');
    const respuesta = await request(app)
      .post('/api/galeria')
      .set('Authorization', `Bearer ${token}`)
      .attach('imagen', archivoFalso, { contentType: 'image/jpeg' })
      .field('leyenda', 'Intento con contenido falso')
      .field('texto_alternativo', 'Intento con contenido falso');
    expect(respuesta.status).toBe(400);
    fs.unlinkSync(archivoFalso);
  });

  test('flujo completo: subir, ver en público, editar, ocultar, republicar y eliminar', async () => {
    // 1. Subir
    const subida = await request(app)
      .post('/api/galeria')
      .set('Authorization', `Bearer ${token}`)
      .attach('imagen', imagenPrueba, { contentType: 'image/jpeg' })
      .field('leyenda', 'Foto de prueba Jest')
      .field('texto_alternativo', 'Descripción de prueba Jest');
    expect(subida.status).toBe(201);
    expect(subida.body.foto.publicada).toBe(true);
    const fotoId = subida.body.foto.id;

    // 2. Aparece en el listado público, con una URL de imagen servible
    const publicoAntes = await request(app).get('/api/publico/galeria');
    const entradaPublica = publicoAntes.body.fotos.find((f) => f.id === fotoId);
    expect(entradaPublica).toBeDefined();
    expect(entradaPublica.caption).toBe('Foto de prueba Jest');
    expect(entradaPublica.src).toBe(`/publico/galeria/${fotoId}/imagen`);

    const imagenPublica = await request(app).get(`/api/publico/galeria/${fotoId}/imagen`);
    expect(imagenPublica.status).toBe(200);
    expect(imagenPublica.headers['content-type']).toMatch(/^image\/jpeg/);

    // 3. Editar leyenda
    const edicion = await request(app)
      .put(`/api/galeria/${fotoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ leyenda: 'Leyenda editada' });
    expect(edicion.status).toBe(200);
    expect(edicion.body.foto.leyenda).toBe('Leyenda editada');

    // 4. Ocultar: desaparece del público (ni en el listado ni la imagen)
    const ocultar = await request(app)
      .put(`/api/galeria/${fotoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publicada: false });
    expect(ocultar.status).toBe(200);

    const publicoOculto = await request(app).get('/api/publico/galeria');
    expect(publicoOculto.body.fotos.some((f) => f.id === fotoId)).toBe(false);

    const imagenOculta = await request(app).get(`/api/publico/galeria/${fotoId}/imagen`);
    expect(imagenOculta.status).toBe(404);

    // ...pero la Administración sigue pudiendo verla (para decidir si la republica)
    const imagenAdmin = await request(app)
      .get(`/api/galeria/${fotoId}/imagen`)
      .set('Authorization', `Bearer ${token}`);
    expect(imagenAdmin.status).toBe(200);

    // 5. Republicar: vuelve a aparecer
    await request(app)
      .put(`/api/galeria/${fotoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publicada: true });
    const publicoRepublicado = await request(app).get('/api/publico/galeria');
    expect(publicoRepublicado.body.fotos.some((f) => f.id === fotoId)).toBe(true);

    // 6. Eliminar: ya no existe en ningún lado
    const eliminacion = await request(app)
      .delete(`/api/galeria/${fotoId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(eliminacion.status).toBe(200);

    const publicoFinal = await request(app).get('/api/publico/galeria');
    expect(publicoFinal.body.fotos.some((f) => f.id === fotoId)).toBe(false);
  });

  test('editar/eliminar una foto que no existe responde 404', async () => {
    const idInexistente = '00000000-0000-0000-0000-000000000000';
    const edicion = await request(app)
      .put(`/api/galeria/${idInexistente}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ leyenda: 'No debería aplicarse' });
    expect(edicion.status).toBe(404);

    const eliminacion = await request(app)
      .delete(`/api/galeria/${idInexistente}`)
      .set('Authorization', `Bearer ${token}`);
    expect(eliminacion.status).toBe(404);
  });

  test('pedir la imagen de una foto que no existe (público) responde 404, no 500', async () => {
    const respuesta = await request(app).get('/api/publico/galeria/00000000-0000-0000-0000-000000000000/imagen');
    expect(respuesta.status).toBe(404);
  });

  describe('vigencia automática (vigente_hasta)', () => {
    test('un cartel con vigente_hasta en el futuro aparece en público', async () => {
      const manana = await fechaBD(1);
      const subida = await request(app)
        .post('/api/galeria')
        .set('Authorization', `Bearer ${token}`)
        .attach('imagen', imagenPrueba, { contentType: 'image/jpeg' })
        .field('leyenda', 'Cartel vigente Jest')
        .field('texto_alternativo', 'Cartel vigente Jest')
        .field('vigente_hasta', manana);
      expect(subida.status).toBe(201);
      expect(subida.body.foto.vigente_hasta).toBe(manana);

      const publico = await request(app).get('/api/publico/galeria');
      expect(publico.body.fotos.some((f) => f.id === subida.body.foto.id)).toBe(true);

      await request(app).delete(`/api/galeria/${subida.body.foto.id}`).set('Authorization', `Bearer ${token}`);
    });

    test('un cartel con vigente_hasta en el pasado no aparece en público (ni el listado ni la imagen), pero sí en Administración', async () => {
      const ayer = await fechaBD(-1);
      const subida = await request(app)
        .post('/api/galeria')
        .set('Authorization', `Bearer ${token}`)
        .attach('imagen', imagenPrueba, { contentType: 'image/jpeg' })
        .field('leyenda', 'Cartel vencido Jest')
        .field('texto_alternativo', 'Cartel vencido Jest')
        .field('vigente_hasta', ayer);
      const fotoId = subida.body.foto.id;

      const publico = await request(app).get('/api/publico/galeria');
      expect(publico.body.fotos.some((f) => f.id === fotoId)).toBe(false);

      const imagenPublica = await request(app).get(`/api/publico/galeria/${fotoId}/imagen`);
      expect(imagenPublica.status).toBe(404);

      const admin = await request(app).get('/api/galeria').set('Authorization', `Bearer ${token}`);
      expect(admin.body.fotos.some((f) => f.id === fotoId)).toBe(true);

      const imagenAdmin = await request(app).get(`/api/galeria/${fotoId}/imagen`).set('Authorization', `Bearer ${token}`);
      expect(imagenAdmin.status).toBe(200);

      await request(app).delete(`/api/galeria/${fotoId}`).set('Authorization', `Bearer ${token}`);
    });

    test('quitar la vigencia (vigente_hasta vacío) hace que un cartel vencido vuelva a aparecer', async () => {
      const ayer = await fechaBD(-1);
      const subida = await request(app)
        .post('/api/galeria')
        .set('Authorization', `Bearer ${token}`)
        .attach('imagen', imagenPrueba, { contentType: 'image/jpeg' })
        .field('leyenda', 'Cartel a reactivar Jest')
        .field('texto_alternativo', 'Cartel a reactivar Jest')
        .field('vigente_hasta', ayer);
      const fotoId = subida.body.foto.id;

      const quitarVigencia = await request(app)
        .put(`/api/galeria/${fotoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vigente_hasta: '' });
      expect(quitarVigencia.status).toBe(200);
      expect(quitarVigencia.body.foto.vigente_hasta).toBeNull();

      const publico = await request(app).get('/api/publico/galeria');
      expect(publico.body.fotos.some((f) => f.id === fotoId)).toBe(true);

      await request(app).delete(`/api/galeria/${fotoId}`).set('Authorization', `Bearer ${token}`);
    });
  });
});
