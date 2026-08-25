const { app, request, loginComoAdmin } = require('./helpers');

describe('Inventario', () => {
  let token;
  let articuloId;

  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('un rol que no es super_admin no puede acceder a inventario (403)', async () => {
    const correo = `coord.inventario.${Date.now()}@sigevac.local`;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Coordinador Inventario', correo, password: 'Coord#12345', rol: 'coordinador' });
    const login = await request(app).post('/api/auth/login').send({ correo, password: 'Coord#12345' });

    const respuesta = await request(app).get('/api/inventario').set('Authorization', `Bearer ${login.body.access_token}`);
    expect(respuesta.status).toBe(403);
  });

  test('super_admin puede crear un artículo', async () => {
    const respuesta = await request(app)
      .post('/api/inventario')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Playeras staff ${Date.now()}`, unidad: 'pieza', minimo: 5 });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.articulo.existencias).toBe(0);
    articuloId = respuesta.body.articulo.id;
  });

  test('un movimiento de entrada incrementa las existencias', async () => {
    const respuesta = await request(app)
      .post(`/api/inventario/${articuloId}/movimientos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'entrada', cantidad: 20 });
    expect(respuesta.status).toBe(201);

    const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${token}`);
    const articulo = lista.body.articulos.find((a) => a.id === articuloId);
    expect(articulo.existencias).toBe(20);
  });

  test('una salida mayor a las existencias disponibles responde error, sin dejar el inventario en negativo', async () => {
    const respuesta = await request(app)
      .post(`/api/inventario/${articuloId}/movimientos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'salida', cantidad: 999 });
    expect(respuesta.status).toBe(400);

    const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${token}`);
    const articulo = lista.body.articulos.find((a) => a.id === articuloId);
    expect(articulo.existencias).toBe(20); // no debe haber cambiado
  });

  test('una salida válida descuenta las existencias correctamente', async () => {
    await request(app)
      .post(`/api/inventario/${articuloId}/movimientos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'salida', cantidad: 8 });

    const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${token}`);
    const articulo = lista.body.articulos.find((a) => a.id === articuloId);
    expect(articulo.existencias).toBe(12);
  });
});

describe('Cuotas', () => {
  let token;
  let cuotaId;
  let voluntarioId;

  beforeAll(async () => {
    token = (await loginComoAdmin()).access_token;
    const alta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'CuotaTest', apellidoPaterno: 'Prueba', fechaNacimiento: '1995-05-05' });
    voluntarioId = alta.body.voluntario.id;
  });

  test('crear una cuota', async () => {
    const respuesta = await request(app)
      .post('/api/cuotas')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Cuota mensual', monto: 100, periodo: '2026-08' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cuota.monto).toBe('100.00'); // NUMERIC de Postgres viaja como string
    cuotaId = respuesta.body.cuota.id;
  });

  test(
    'REGRESIÓN: registrar un pago funciona correctamente (bug corregido: el controlador ' +
    'reenviaba cuota_id/voluntario_id en snake_case a un modelo que esperaba camelCase, ' +
    'así que el pago SIEMPRE fallaba con "no pertenecen a la misma asociación")',
    async () => {
      const respuesta = await request(app)
        .post('/api/cuotas/pagos')
        .set('Authorization', `Bearer ${token}`)
        .send({ cuota_id: cuotaId, voluntario_id: voluntarioId, monto: 100, metodo: 'efectivo' });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pago.voluntario_id).toBe(voluntarioId);
    }
  );

  test('el total pagado de la cuota refleja el pago recién registrado', async () => {
    const respuesta = await request(app).get('/api/cuotas').set('Authorization', `Bearer ${token}`);
    const cuota = respuesta.body.cuotas.find((c) => c.id === cuotaId);
    expect(Number(cuota.total_pagado)).toBe(100);
  });

  test('registrar un pago con un voluntario de otra asociación se rechaza (400)', async () => {
    const respuesta = await request(app)
      .post('/api/cuotas/pagos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuota_id: cuotaId, voluntario_id: '00000000-0000-0000-0000-000000000000', monto: 50 });
    expect(respuesta.status).toBe(400);
  });
});

describe('Solicitudes de voluntariado (formulario público)', () => {
  let token;
  let asociacionId;
  let solicitudId;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
    asociacionId = admin.usuario.asociacion_id;
  });

  test('GET /api/asociacion/publicas NO requiere autenticación y solo expone id+nombre', async () => {
    const respuesta = await request(app).get('/api/asociacion/publicas');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.asociaciones.length).toBeGreaterThan(0);
    const primera = respuesta.body.asociaciones[0];
    expect(Object.keys(primera).sort()).toEqual(['id', 'nombre']);
  });

  test('cualquier persona (sin sesión) puede enviar una solicitud', async () => {
    const respuesta = await request(app)
      .post('/api/solicitudes')
      .send({ asociacion_id: asociacionId, nombre: 'Aspirante Voluntario', correo: `aspirante.${Date.now()}@ejemplo.com`, mensaje: 'Quiero ayudar' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.solicitud.estado).toBe('pendiente');
    solicitudId = respuesta.body.solicitud.id;
  });

  test('enviar una solicitud sin correo responde 400', async () => {
    const respuesta = await request(app).post('/api/solicitudes').send({ asociacion_id: asociacionId, nombre: 'Sin correo' });
    expect(respuesta.status).toBe(400);
  });

  test('listar solicitudes requiere ser super_admin', async () => {
    const sinToken = await request(app).get('/api/solicitudes');
    expect(sinToken.status).toBe(401);
  });

  test('super_admin puede listar y cambiar el estado de una solicitud', async () => {
    const lista = await request(app).get('/api/solicitudes').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.solicitudes.some((s) => s.id === solicitudId)).toBe(true);

    const cambio = await request(app)
      .patch(`/api/solicitudes/${solicitudId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'aprobada' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.solicitud.estado).toBe('aprobada');
    expect(cambio.body.solicitud.revisada_por).toBeTruthy();
  });

  test('un estado inválido responde 400', async () => {
    const respuesta = await request(app)
      .patch(`/api/solicitudes/${solicitudId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'no_existe' });
    expect(respuesta.status).toBe(400);
  });
});
