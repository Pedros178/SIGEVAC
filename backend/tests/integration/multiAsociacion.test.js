const { app, request, loginComoAdmin } = require('./helpers');

/**
 * Multi-asociación (N:M) fue agregado DESPUÉS de la suite de pruebas
 * original (que solo cubría hasta Fase 6 con una sola asociación por
 * instalación). Estas pruebas cubren justo la parte más delicada de esa
 * funcionalidad por tocar autenticación y aislamiento de datos: que un
 * usuario con acceso a varias asociaciones solo vea los datos de la
 * asociación que tiene activa en cada momento.
 */
describe('Multi-asociación (N:M)', () => {
  let tokenAdmin;
  let asociacionOriginalId;
  let asociacionNuevaId;
  let usuarioMultiId;
  let tokenUsuarioMulti;
  let agenteUsuarioMulti;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    tokenAdmin = admin.access_token;
    asociacionOriginalId = admin.usuario.asociacion_id;
  });

  test('un rol distinto a super_admin NO puede registrar una asociación nueva (403)', async () => {
    const coordinadorCorreo = `coord.multiasoc.${Date.now()}@sigevac.local`;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Coordinador MultiAsoc', correo: coordinadorCorreo, password: 'Coord#12345', rol: 'coordinador' });
    const loginCoord = await request(app)
      .post('/api/auth/login')
      .send({ correo: coordinadorCorreo, password: 'Coord#12345' });

    const respuesta = await request(app)
      .post('/api/asociacion')
      .set('Authorization', `Bearer ${loginCoord.body.access_token}`)
      .send({ nombre: 'Asociación No Autorizada' });
    expect(respuesta.status).toBe(403);
  });

  test('super_admin SÍ puede registrar una asociación civil nueva (Módulo 3)', async () => {
    const respuesta = await request(app)
      .post('/api/asociacion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: `Fundación de Pruebas Jest ${Date.now()}`, municipio: 'Tehuacán', estado: 'Puebla' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.asociacion).toHaveProperty('id');
    asociacionNuevaId = respuesta.body.asociacion.id;
  });

  test('GET /api/asociacion/todas incluye la asociación recién creada', async () => {
    const respuesta = await request(app).get('/api/asociacion/todas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.asociaciones.some((a) => a.id === asociacionNuevaId)).toBe(true);
  });

  test('un usuario nuevo nace perteneciendo solo a la asociación de quien lo creó', async () => {
    const correo = `multiasoc.usuario.${Date.now()}@sigevac.local`;
    const crear = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Usuario MultiAsociación', correo, password: 'Multi#12345', rol: 'coordinador' });
    expect(crear.status).toBe(201);
    usuarioMultiId = crear.body.usuario.id;

    const asociaciones = await request(app)
      .get(`/api/usuarios/${usuarioMultiId}/asociaciones`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(asociaciones.status).toBe(200);
    expect(asociaciones.body.asociaciones).toHaveLength(1);
    expect(asociaciones.body.asociaciones[0].id).toBe(asociacionOriginalId);

    // Usamos un agent desde el login para que la cookie httpOnly del
    // refresh token viaje sola en las siguientes peticiones de este
    // usuario (asociacion-activa, refresh), tal como haría un navegador.
    agenteUsuarioMulti = request.agent(app);
    const login = await agenteUsuarioMulti.post('/api/auth/login').send({ correo, password: 'Multi#12345' });
    tokenUsuarioMulti = login.body.access_token;
    expect(login.body.usuario.asociaciones).toHaveLength(1);
  });

  test('super_admin agrega al usuario a la segunda asociación', async () => {
    const respuesta = await request(app)
      .post(`/api/usuarios/${usuarioMultiId}/asociaciones`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ asociacion_id: asociacionNuevaId, es_predeterminada: false });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.asociaciones).toHaveLength(2);
  });

  test('tras el alta, /api/auth/me ya refleja las dos asociaciones (usa datos frescos, no el token viejo)', async () => {
    const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenUsuarioMulti}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.asociaciones).toHaveLength(2);
  });

  test('el usuario NO puede cambiar a una asociación a la que no pertenece (403)', async () => {
    const respuesta = await request(app)
      .post('/api/auth/asociacion-activa')
      .set('Authorization', `Bearer ${tokenUsuarioMulti}`)
      .send({ asociacion_id: '00000000-0000-0000-0000-000000000000' });
    expect(respuesta.status).toBe(403);
  });

  test('el usuario SÍ puede cambiar a la asociación nueva, y recibe un access token actualizado', async () => {
    const respuesta = await agenteUsuarioMulti
      .post('/api/auth/asociacion-activa')
      .set('Authorization', `Bearer ${tokenUsuarioMulti}`)
      .send({ asociacion_id: asociacionNuevaId });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.asociacion_id).toBe(asociacionNuevaId);
    expect(respuesta.body).toHaveProperty('access_token');
    // El refresh token ya no viaja en el cuerpo (revisión de seguridad):
    // la cookie httpOnly del agent se actualizó sola con la petición.
    tokenUsuarioMulti = respuesta.body.access_token;
  });

  test('AISLAMIENTO: un voluntario creado con la asociación activa nueva NO aparece para quien sigue en la asociación original', async () => {
    const nombreUnico = `AisladoMultiAsoc${Date.now()}`;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${tokenUsuarioMulti}`)
      .send({ nombre: nombreUnico, apellidoPaterno: 'Prueba', fechaNacimiento: '1990-01-01' });
    expect(alta.status).toBe(201);
    expect(alta.body.voluntario.asociacion_id).toBe(asociacionNuevaId);

    // El admin sigue con su asociación original activa: no debería verlo.
    const listaAdmin = await request(app)
      .get('/api/voluntarios')
      .query({ busqueda: nombreUnico })
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(listaAdmin.body.voluntarios.some((v) => v.nombre === nombreUnico)).toBe(false);

    // Pero sí debe aparecer para el propio usuario, en su asociación activa.
    const listaUsuario = await request(app)
      .get('/api/voluntarios')
      .query({ busqueda: nombreUnico })
      .set('Authorization', `Bearer ${tokenUsuarioMulti}`);
    expect(listaUsuario.body.voluntarios.some((v) => v.nombre === nombreUnico)).toBe(true);
  });

  test('/api/auth/refresh conserva la asociación activa elegida (no vuelve a la predeterminada)', async () => {
    const respuesta = await agenteUsuarioMulti.post('/api/auth/refresh').send();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.asociacion_id).toBe(asociacionNuevaId);
  });

  test('quitar a un usuario de su única asociación restante responde 400', async () => {
    // El usuario de prueba ya tiene 2; lo dejamos con 1 primero.
    await request(app)
      .delete(`/api/usuarios/${usuarioMultiId}/asociaciones/${asociacionNuevaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const respuesta = await request(app)
      .delete(`/api/usuarios/${usuarioMultiId}/asociaciones/${asociacionOriginalId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(respuesta.status).toBe(400);
  });
});
