const { app, request, loginComoAdmin } = require('./helpers');

describe('Documentos requeridos por asociación (tabla asociacion_config_documentos)', () => {
  let tokenAdmin;
  let tokenCoordinador;
  let tipos;
  const sufijo = Date.now();
  const correoCoordinador = `coordinador.docs.${sufijo}@sigevac.local`;
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const claveToId = (clave) => tipos.find((t) => t.clave === clave).tipo_documento_id;

  async function clavesDeExpedienteNuevo({ fechaNacimiento, nombre }) {
    const alta = await request(app).post('/api/voluntarios').set(auth(tokenAdmin)).send({ nombre, apellidoPaterno: 'Docs', fechaNacimiento });
    expect(alta.status).toBe(201);
    const exp = await request(app).get(`/api/voluntarios/${alta.body.voluntario.id}/expediente`).set(auth(tokenAdmin));
    return exp.body.expediente.documentos.map((d) => d.tipo_clave);
  }

  async function restablecerTodo() {
    const lista = await request(app).get('/api/configuracion/documentos-requeridos').set(auth(tokenAdmin));
    for (const d of lista.body.documentos.filter((x) => x.personalizado)) {
      await request(app).delete(`/api/configuracion/documentos-requeridos/${d.tipo_documento_id}`).set(auth(tokenAdmin));
    }
  }

  beforeAll(async () => {
    tokenAdmin = (await loginComoAdmin()).access_token;
    await request(app).post('/api/usuarios').set(auth(tokenAdmin))
      .send({ nombre: 'Coordinador Docs', correo: correoCoordinador, password: 'Coord#12345', rol: 'coordinador' });
    tokenCoordinador = (await request(app).post('/api/auth/login').send({ correo: correoCoordinador, password: 'Coord#12345' })).body.access_token;
    await restablecerTodo();
    tipos = (await request(app).get('/api/configuracion/documentos-requeridos').set(auth(tokenAdmin))).body.documentos;
  });

  afterAll(restablecerTodo);

  test('sin sesión responde 401 y sin configuracion.editar no se puede modificar (403)', async () => {
    expect((await request(app).get('/api/configuracion/documentos-requeridos')).status).toBe(401);
    const respuesta = await request(app)
      .put(`/api/configuracion/documentos-requeridos/${claveToId('uso_imagen')}`)
      .set(auth(tokenCoordinador)).send({ obligatorio: false });
    expect(respuesta.status).toBe(403);
  });

  test('lista todos los tipos con su valor predeterminado (obligatorio y sin personalizar)', async () => {
    expect(tipos.length).toBeGreaterThanOrEqual(11);
    const usoImagen = tipos.find((t) => t.clave === 'uso_imagen');
    expect(usoImagen).toMatchObject({ obligatorio: true, personalizado: false, aplica_a: 'ambos', aplica_a_predeterminado: 'ambos' });
  });

  test('valida el cuerpo: vacío, tipos incorrectos y aplica_a fuera de catálogo dan 400; id no UUID da 404', async () => {
    const id = claveToId('curp');
    const enviar = (cuerpo) => request(app).put(`/api/configuracion/documentos-requeridos/${id}`).set(auth(tokenAdmin)).send(cuerpo);
    expect((await enviar({})).status).toBe(400);
    expect((await enviar({ obligatorio: 'no' })).status).toBe(400);
    expect((await enviar({ aplica_a: 'todos' })).status).toBe(400);
    const noUuid = await request(app).put('/api/configuracion/documentos-requeridos/xyz').set(auth(tokenAdmin)).send({ obligatorio: false });
    expect(noUuid.status).toBe(404);
    const inexistente = await request(app)
      .put('/api/configuracion/documentos-requeridos/00000000-0000-4000-8000-000000000000').set(auth(tokenAdmin)).send({ obligatorio: false });
    expect(inexistente.status).toBe(404);
  });

  test('marcar un documento como no obligatorio deja de generarlo en expedientes nuevos; restablecer lo devuelve', async () => {
    const antes = await clavesDeExpedienteNuevo({ nombre: 'Antes', fechaNacimiento: '1990-01-01' });
    expect(antes).toContain('uso_imagen');

    const guardado = await request(app)
      .put(`/api/configuracion/documentos-requeridos/${claveToId('uso_imagen')}`).set(auth(tokenAdmin)).send({ obligatorio: false });
    expect(guardado.status).toBe(200);
    expect(guardado.body.configuracion).toMatchObject({ obligatorio: false, aplica_a: 'ambos' });

    const durante = await clavesDeExpedienteNuevo({ nombre: 'Durante', fechaNacimiento: '1990-01-01' });
    expect(durante).not.toContain('uso_imagen');
    expect(durante).toContain('curp');

    const lista = await request(app).get('/api/configuracion/documentos-requeridos').set(auth(tokenAdmin));
    expect(lista.body.documentos.find((t) => t.clave === 'uso_imagen')).toMatchObject({ obligatorio: false, personalizado: true });

    expect((await request(app).delete(`/api/configuracion/documentos-requeridos/${claveToId('uso_imagen')}`).set(auth(tokenAdmin))).status).toBe(200);
    const despues = await clavesDeExpedienteNuevo({ nombre: 'Después', fechaNacimiento: '1990-01-01' });
    expect(despues).toContain('uso_imagen');
  });

  test('cambiar aplica_a re-dirige el documento: solo a menores, solo a mayores o a ambos', async () => {
    await request(app)
      .put(`/api/configuracion/documentos-requeridos/${claveToId('reglamento_interno')}`).set(auth(tokenAdmin)).send({ aplica_a: 'menor' });
    const hoy = new Date();
    const menor = `${hoy.getFullYear() - 12}-06-15`;
    const adulto = await clavesDeExpedienteNuevo({ nombre: 'Adulto', fechaNacimiento: '1990-01-01' });
    expect(adulto).not.toContain('reglamento_interno');

    // Un menor exige tutor; el documento ahora SÍ debe aparecer para menores
    const alta = await request(app).post('/api/voluntarios').set(auth(tokenAdmin))
      .send({ nombre: 'Menor', apellidoPaterno: 'Docs', fechaNacimiento: menor, tutor: { nombre: 'Tutor Docs', parentesco: 'madre' } });
    expect(alta.status).toBe(201);
    const exp = await request(app).get(`/api/voluntarios/${alta.body.voluntario.id}/expediente`).set(auth(tokenAdmin));
    expect(exp.body.expediente.documentos.map((d) => d.tipo_clave)).toContain('reglamento_interno');

    await request(app).delete(`/api/configuracion/documentos-requeridos/${claveToId('reglamento_interno')}`).set(auth(tokenAdmin));
  });
});
