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
