const { app, request, loginComoAdmin } = require('./helpers');

describe('Catálogos genéricos (tabla `catalogos`): lectura pública y administración', () => {
  let tokenAdmin;
  let tokenCoordinador;
  const sufijo = Date.now();
  const correoCoordinador = `coordinador.catalogos.${sufijo}@sigevac.local`;
  const tipoPrueba = `tipo_prueba_${sufijo}`;
  let opcionId;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    tokenAdmin = admin.access_token;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Coordinador Catálogos', correo: correoCoordinador, password: 'Coord#12345', rol: 'coordinador' });
    const login = await request(app).post('/api/auth/login').send({ correo: correoCoordinador, password: 'Coord#12345' });
    tokenCoordinador = login.body.access_token;
  });

  test('GET /api/catalogos/tipo_sangre es público y devuelve las 8 opciones en orden', async () => {
    const respuesta = await request(app).get('/api/catalogos/tipo_sangre');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.opciones.map((o) => o.etiqueta)).toEqual(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);
  });

  test('GET /api/catalogos/parentesco devuelve las opciones sembradas con clave y etiqueta', async () => {
    const respuesta = await request(app).get('/api/catalogos/parentesco');
    expect(respuesta.status).toBe(200);
    const claves = respuesta.body.opciones.map((o) => o.clave);
    expect(claves).toEqual(expect.arrayContaining(['madre', 'padre', 'tutor', 'abuelo', 'hermano']));
    expect(respuesta.body.opciones.find((o) => o.clave === 'tutor').etiqueta).toBe('Tutor legal');
  });

  test('un tipo que no existe devuelve lista vacía, y uno con formato inválido responde 400', async () => {
    const vacio = await request(app).get('/api/catalogos/no_existe_este_tipo');
    expect(vacio.status).toBe(200);
    expect(vacio.body.opciones).toEqual([]);
    const invalido = await request(app).get('/api/catalogos/Tipo-Inválido');
    expect(invalido.status).toBe(400);
  });

  test('la ruta pública no tapa a /catalogos/ubicaciones ni deja listar la administración sin sesión', async () => {
    const ubicaciones = await request(app).get('/api/catalogos/ubicaciones');
    expect(ubicaciones.status).toBe(200);
    expect(Array.isArray(ubicaciones.body.ubicaciones)).toBe(true);
    const sinSesion = await request(app).get('/api/catalogos');
    expect(sinSesion.status).toBe(401);
  });

  test('sin el permiso configuracion.editar no se puede crear, editar ni eliminar (403)', async () => {
    const crear = await request(app)
      .post('/api/catalogos').set('Authorization', `Bearer ${tokenCoordinador}`)
      .send({ tipo: tipoPrueba, clave: 'x', etiqueta: 'X' });
    expect(crear.status).toBe(403);
    const fila = (await request(app).get('/api/catalogos/parentesco')).body.opciones[0];
    const editar = await request(app)
      .put(`/api/catalogos/${fila.id}`).set('Authorization', `Bearer ${tokenCoordinador}`).send({ etiqueta: 'Hackeado' });
    expect(editar.status).toBe(403);
    const eliminar = await request(app).delete(`/api/catalogos/${fila.id}`).set('Authorization', `Bearer ${tokenCoordinador}`);
    expect(eliminar.status).toBe(403);
  });

  test('crear valida tipo, clave, etiqueta y orden', async () => {
    const enviar = (cuerpo) => request(app).post('/api/catalogos').set('Authorization', `Bearer ${tokenAdmin}`).send(cuerpo);
    expect((await enviar({ tipo: 'Mal Tipo', clave: 'a', etiqueta: 'A' })).status).toBe(400);
    expect((await enviar({ tipo: tipoPrueba, clave: 'Clave Mala', etiqueta: 'A' })).status).toBe(400);
    expect((await enviar({ tipo: tipoPrueba, clave: 'a', etiqueta: '   ' })).status).toBe(400);
    expect((await enviar({ tipo: tipoPrueba, clave: 'a', etiqueta: 'A', orden: -3 })).status).toBe(400);
  });

  test('flujo completo: crear, aparece en la lista pública, duplicado 409, editar y eliminar', async () => {
    const creada = await request(app)
      .post('/api/catalogos').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: tipoPrueba, clave: 'opcion_uno', etiqueta: 'Opción uno', orden: 2 });
    expect(creada.status).toBe(201);
    opcionId = creada.body.opcion.id;

    await request(app)
      .post('/api/catalogos').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: tipoPrueba, clave: 'opcion_cero', etiqueta: 'Opción cero', orden: 1 });

    const publica = await request(app).get(`/api/catalogos/${tipoPrueba}`);
    expect(publica.body.opciones.map((o) => o.clave)).toEqual(['opcion_cero', 'opcion_uno']);

    const duplicada = await request(app)
      .post('/api/catalogos').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tipo: tipoPrueba, clave: 'opcion_uno', etiqueta: 'Otra' });
    expect(duplicada.status).toBe(409);

    const editada = await request(app)
      .put(`/api/catalogos/${opcionId}`).set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ etiqueta: 'Opción uno (editada)', orden: 0 });
    expect(editada.status).toBe(200);
    expect(editada.body.opcion.etiqueta).toBe('Opción uno (editada)');
    expect((await request(app).get(`/api/catalogos/${tipoPrueba}`)).body.opciones[0].clave).toBe('opcion_uno');

    const admin = await request(app).get('/api/catalogos').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(admin.status).toBe(200);
    expect(admin.body.catalogos.some((o) => o.tipo === tipoPrueba)).toBe(true);

    const eliminada = await request(app).delete(`/api/catalogos/${opcionId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(eliminada.status).toBe(200);
    const otraVez = await request(app).delete(`/api/catalogos/${opcionId}`).set('Authorization', `Bearer ${tokenAdmin}`);
    expect(otraVez.status).toBe(404);
  });

  test('editar o eliminar con un id que no es UUID responde 404, no 500', async () => {
    const editar = await request(app).put('/api/catalogos/no-es-uuid').set('Authorization', `Bearer ${tokenAdmin}`).send({ etiqueta: 'X' });
    expect(editar.status).toBe(404);
    const eliminar = await request(app).delete('/api/catalogos/no-es-uuid').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(eliminar.status).toBe(404);
  });
});
