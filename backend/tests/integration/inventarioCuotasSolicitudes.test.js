const { app, request, loginComoAdmin } = require('./helpers');

describe('Inventario', () => {
  let token;
  let categoriaId;
  let subcategoriaId;
  let articuloId;

  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('un rol sin permiso "inventario.gestionar" no puede crear artículos (403)', async () => {
    const correo = `supervisor.inventario.${Date.now()}@sigevac.local`;
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Supervisor Inventario', correo, password: 'Superv#12345', rol: 'supervisor' });
    const login = await request(app).post('/api/auth/login').send({ correo, password: 'Superv#12345' });

    // "supervisor" sí tiene inventario.consultar (puede listar)...
    const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${login.body.access_token}`);
    expect(lista.status).toBe(200);

    // ...pero no inventario.gestionar (no puede crear).
    const crear = await request(app)
      .post('/api/inventario')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ nombre: 'Intento no autorizado' });
    expect(crear.status).toBe(403);
  });

  test('super_admin puede crear una categoría y una subcategoría', async () => {
    const categoria = await request(app)
      .post('/api/inventario/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `Vestuario ${Date.now()}` });
    expect(categoria.status).toBe(201);
    categoriaId = categoria.body.categoria.id;

    const subcategoria = await request(app)
      .post('/api/inventario/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Sombreros', categoria_padre_id: categoriaId });
    expect(subcategoria.status).toBe(201);
    subcategoriaId = subcategoria.body.categoria.id;
  });

  test('no se admite una subcategoría de tercer nivel', async () => {
    const respuesta = await request(app)
      .post('/api/inventario/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nivel 3', categoria_padre_id: subcategoriaId });
    expect(respuesta.status).toBe(400);
  });

  test('super_admin puede crear un artículo con categoría/subcategoría, y recibe SKU y código QR', async () => {
    const respuesta = await request(app)
      .post('/api/inventario')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: `Sombrero de charro ${Date.now()}`, unidad: 'pieza', minimo: 5,
        categoria_id: categoriaId, subcategoria_id: subcategoriaId, ubicacion: 'Bodega principal',
        es_prestable: true,
      });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.articulo.existencias).toBe(0);
    expect(respuesta.body.articulo.estado_fisico).toBe('bueno');
    expect(respuesta.body.articulo.sku).toBeTruthy();
    expect(respuesta.body.articulo.codigo_qr).toBeTruthy();
    expect(respuesta.body.articulo.es_prestable).toBe(true);
    articuloId = respuesta.body.articulo.id;
  });

  test('la ficha del artículo se puede consultar por su código QR', async () => {
    const detalle = await request(app).get(`/api/inventario/${articuloId}`).set('Authorization', `Bearer ${token}`);
    const respuesta = await request(app)
      .get(`/api/inventario/qr/${detalle.body.articulo.codigo_qr}`)
      .set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.articulo.id).toBe(articuloId);
    expect(Array.isArray(respuesta.body.articulo.movimientos)).toBe(true);
    expect(Array.isArray(respuesta.body.articulo.mantenimientos)).toBe(true);
  });

  test('buscar un código QR inexistente responde 404', async () => {
    const respuesta = await request(app).get('/api/inventario/qr/SGV-INV-NOEXISTE').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(404);
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

  test('un mantenimiento se puede registrar y aparece en el historial del artículo', async () => {
    const respuesta = await request(app)
      .post(`/api/inventario/${articuloId}/mantenimientos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'Reparación de costura', descripcion: 'Se descosió el ala', costo: 50 });
    expect(respuesta.status).toBe(201);

    const detalle = await request(app).get(`/api/inventario/${articuloId}`).set('Authorization', `Bearer ${token}`);
    expect(detalle.body.articulo.mantenimientos.length).toBeGreaterThan(0);
  });

  describe('Préstamos formales', () => {
    let prestamoId;

    test('un artículo no marcado como "se puede prestar" no admite préstamos (400)', async () => {
      const consumible = await request(app)
        .post('/api/inventario')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: `Resma de papel ${Date.now()}`, es_prestable: false });
      const idConsumible = consumible.body.articulo.id;
      await request(app)
        .post(`/api/inventario/${idConsumible}/movimientos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'entrada', cantidad: 10 });

      const respuesta = await request(app)
        .post('/api/inventario/prestamos')
        .set('Authorization', `Bearer ${token}`)
        .send({ articulo_id: idConsumible, cantidad: 1, responsable: 'Alguien', fecha_devolucion_programada: '2099-01-01' });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toMatch(/no está marcado como prestable/i);
    });

    test('registrar un préstamo descuenta existencias y deja el artículo en estado "prestado"', async () => {
      const respuesta = await request(app)
        .post('/api/inventario/prestamos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          articulo_id: articuloId, cantidad: 3, responsable: 'Compañía de danza folclórica',
          fecha_devolucion_programada: '2099-01-01', condicion_entrega: 'Buen estado, sin manchas',
        });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.prestamo.estado).toBe('prestado');
      prestamoId = respuesta.body.prestamo.id;

      const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${token}`);
      const articulo = lista.body.articulos.find((a) => a.id === articuloId);
      expect(articulo.existencias).toBe(9); // 12 - 3
    });

    test('un préstamo por más cantidad de la disponible se rechaza (400)', async () => {
      const respuesta = await request(app)
        .post('/api/inventario/prestamos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          articulo_id: articuloId, cantidad: 999, responsable: 'Otro grupo',
          fecha_devolucion_programada: '2099-01-01',
        });
      expect(respuesta.status).toBe(400);
    });

    test('devolver el préstamo restaura las existencias', async () => {
      const respuesta = await request(app)
        .put(`/api/inventario/prestamos/${prestamoId}/devolver`)
        .set('Authorization', `Bearer ${token}`)
        .send({ condicion_retorno: 'Se devolvió completo y en buen estado' });
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.prestamo.estado).toBe('devuelto');

      const lista = await request(app).get('/api/inventario').set('Authorization', `Bearer ${token}`);
      const articulo = lista.body.articulos.find((a) => a.id === articuloId);
      expect(articulo.existencias).toBe(12); // 9 + 3 de vuelta
    });

    test('devolver un préstamo ya devuelto responde 404 (no se puede devolver dos veces)', async () => {
      const respuesta = await request(app)
        .put(`/api/inventario/prestamos/${prestamoId}/devolver`)
        .set('Authorization', `Bearer ${token}`)
        .send({ condicion_retorno: 'x' });
      expect(respuesta.status).toBe(404);
    });

    test('un préstamo se puede ligar a una actividad real y aparece con su nombre', async () => {
      const actividad = await request(app)
        .post('/api/actividades')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: `Festival de danza ${Date.now()}`, fecha: '2099-06-01', lugar: 'Auditorio' });
      expect(actividad.status).toBe(201);

      const prestamo = await request(app)
        .post('/api/inventario/prestamos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          articulo_id: articuloId, cantidad: 1, responsable: 'Comité del festival',
          actividad_id: actividad.body.actividad.id, fecha_devolucion_programada: '2099-06-02',
        });
      expect(prestamo.status).toBe(201);

      const lista = await request(app).get('/api/inventario/prestamos').set('Authorization', `Bearer ${token}`);
      const encontrado = lista.body.prestamos.find((p) => p.id === prestamo.body.prestamo.id);
      expect(encontrado.actividad_nombre).toBe(actividad.body.actividad.nombre);
    });
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
