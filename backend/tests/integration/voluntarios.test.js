const { app, request, loginComoAdmin } = require('./helpers');

describe('Registro de voluntarios y expediente automático (Módulos 4-9)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  test('registrar un voluntario mayor de edad genera folio y expediente con documentos de mayor', async () => {
    const respuesta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Laura', apellidoPaterno: 'Mendoza', fechaNacimiento: '1995-04-10', correo: `laura.${Date.now()}@example.com` });

    expect(respuesta.status).toBe(201);
    const voluntario = respuesta.body.voluntario;
    expect(voluntario.es_menor_edad).toBe(false);
    expect(voluntario.numero_voluntario).toMatch(/^SC-\d{4}-\d+$/);

    const expedienteResp = await request(app)
      .get(`/api/voluntarios/${voluntario.id}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    expect(expedienteResp.status).toBe(200);
    expect(expedienteResp.body.expediente.estado).toBe('incompleto');
    expect(expedienteResp.body.expediente.porcentaje_avance).toBe(0);

    const claves = expedienteResp.body.expediente.documentos.map((d) => d.tipo_clave);
    expect(claves).toContain('ine');
    expect(claves).toContain('ficha_voluntariado');
    expect(claves).not.toContain('ine_tutor');
    expect(claves).not.toContain('carta_autorizacion');
  });

  test('registrar un voluntario menor de edad SIN datos de tutor responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Pequeño', apellidoPaterno: 'Ramírez', fechaNacimiento: '2015-01-01' });
    expect(respuesta.status).toBe(400);
  });

  test('registrar un voluntario menor de edad CON tutor genera expediente con documentos de menor', async () => {
    const respuesta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Emilia', apellidoPaterno: 'Torres', fechaNacimiento: '2014-06-15',
        tutor: { nombre: 'Marta Torres', parentesco: 'madre', telefono: '2381234567' },
      });

    expect(respuesta.status).toBe(201);
    const voluntario = respuesta.body.voluntario;
    expect(voluntario.es_menor_edad).toBe(true);

    const expedienteResp = await request(app)
      .get(`/api/voluntarios/${voluntario.id}/expediente`)
      .set('Authorization', `Bearer ${token}`);
    const claves = expedienteResp.body.expediente.documentos.map((d) => d.tipo_clave);
    expect(claves).toContain('ine_tutor');
    expect(claves).toContain('carta_autorizacion');
    expect(claves).not.toContain('ine');
    expect(claves).not.toContain('ficha_voluntariado');
    expect(claves).not.toContain('carta_responsiva');
  });

  test('la búsqueda por nombre encuentra al voluntario recién creado', async () => {
    const nombreUnico = `BuscableUnico${Date.now()}`;
    await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: nombreUnico, apellidoPaterno: 'Prueba', fechaNacimiento: '1990-01-01' });

    const busqueda = await request(app)
      .get('/api/voluntarios')
      .query({ busqueda: nombreUnico })
      .set('Authorization', `Bearer ${token}`);

    expect(busqueda.status).toBe(200);
    expect(busqueda.body.voluntarios.some((v) => v.nombre === nombreUnico)).toBe(true);
  });
});

describe('Edición de voluntarios (PUT /api/voluntarios/:id)', () => {
  let token;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    token = admin.access_token;
  });

  async function crearVoluntarioMayor(datosExtra = {}) {
    const respuesta = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Editable', apellidoPaterno: 'DePrueba', fechaNacimiento: '1990-01-01', ...datosExtra });
    return respuesta.body.voluntario;
  }

  test('editar un dato simple de un voluntario mayor de edad no exige tutor y refleja el cambio', async () => {
    const voluntario = await crearVoluntarioMayor();

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '2381110000' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.voluntario.telefono).toBe('2381110000');
    expect(respuesta.body.voluntario.es_menor_edad).toBe(false);
  });

  test('cambiar la fecha de nacimiento de un voluntario mayor a una que lo vuelve menor, SIN tutor, responde 400', async () => {
    const voluntario = await crearVoluntarioMayor();
    const hace10anios = new Date();
    hace10anios.setFullYear(hace10anios.getFullYear() - 10);

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fechaNacimiento: hace10anios.toISOString().slice(0, 10) });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/menor de edad/i);

    // Y el voluntario no debe haber quedado a medio actualizar.
    const sinCambios = await request(app).get(`/api/voluntarios/${voluntario.id}`).set('Authorization', `Bearer ${token}`);
    expect(sinCambios.body.voluntario.es_menor_edad).toBe(false);
  });

  test('cambiar la fecha de nacimiento a una que lo vuelve menor, CON tutor, sí se permite y crea el tutor', async () => {
    const voluntario = await crearVoluntarioMayor();
    const hace10anios = new Date();
    hace10anios.setFullYear(hace10anios.getFullYear() - 10);

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fechaNacimiento: hace10anios.toISOString().slice(0, 10),
        tutor: { nombre: 'Tutor de Prueba', parentesco: 'madre', telefono: '2381110001' },
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.voluntario.es_menor_edad).toBe(true);
  });

  test('editar sin tocar la fecha de nacimiento no exige tutor aunque el voluntario ya sea menor', async () => {
    const nuevo = await request(app)
      .post('/api/voluntarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'YaMenor', apellidoPaterno: 'DePrueba', fechaNacimiento: '2015-01-01',
        tutor: { nombre: 'Tutor Original', parentesco: 'padre', telefono: '2381110002' },
      });
    const voluntario = nuevo.body.voluntario;

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ colonia: 'Centro' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.voluntario.colonia).toBe('Centro');
  });

  test('limpiar el estado también limpia el municipio (no deja un municipio huérfano)', async () => {
    const voluntario = await crearVoluntarioMayor({ estado: 'Puebla', municipio: 'Tehuacán' });

    const conUbicacion = await request(app).get(`/api/voluntarios/${voluntario.id}`).set('Authorization', `Bearer ${token}`);
    expect(conUbicacion.body.voluntario.estado_nombre).toBe('Puebla');
    expect(conUbicacion.body.voluntario.municipio_nombre).toBe('Tehuacán');

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: '', municipio: '' });
    expect(respuesta.status).toBe(200);

    const actualizado = await request(app).get(`/api/voluntarios/${voluntario.id}`).set('Authorization', `Bearer ${token}`);
    expect(actualizado.body.voluntario.estado_nombre).toBeNull();
    expect(actualizado.body.voluntario.municipio_nombre).toBeNull();
  });

  test('cambiar de estado reubica el municipio bajo el nuevo estado', async () => {
    const voluntario = await crearVoluntarioMayor({ estado: 'Puebla', municipio: 'Tehuacán' });

    const respuesta = await request(app)
      .put(`/api/voluntarios/${voluntario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'Oaxaca', municipio: 'Huajuapan de León' });
    expect(respuesta.status).toBe(200);

    const actualizado = await request(app).get(`/api/voluntarios/${voluntario.id}`).set('Authorization', `Bearer ${token}`);
    expect(actualizado.body.voluntario.estado_nombre).toBe('Oaxaca');
    expect(actualizado.body.voluntario.municipio_nombre).toBe('Huajuapan de León');
  });

  test('editar un voluntario inexistente responde 404', async () => {
    const respuesta = await request(app)
      .put('/api/voluntarios/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '2380000000' });
    expect(respuesta.status).toBe(404);
  });
});
