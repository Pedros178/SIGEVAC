const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');
const { estaCifrado } = require('../../src/utils/cifradoDatos');

describe('Fase 13 — datos de salud cifrados en reposo', () => {
  let token;
  beforeAll(async () => {
    ({ access_token: token } = await loginComoAdmin());
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function crearVoluntario(extra = {}) {
    const r = await request(app).post('/api/voluntarios').set(auth()).send({
      nombre: 'Cifrada', apellidoPaterno: 'Prueba', fechaNacimiento: '1994-03-03',
      correo: `cifrada.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`,
      tipoSangre: 'O+', alergias: 'Penicilina', discapacidad: 'Visual leve', enfermedadCronica: 'Asma', consentimientoDatosSensibles: true, ...extra,
    });
    expect(r.status).toBe(201);
    return r.body.voluntario;
  }

  test('en la base de datos los campos de salud quedan cifrados, y la API los devuelve en claro', async () => {
    const v = await crearVoluntario();
    expect(v).toMatchObject({ tipo_sangre: 'O+', alergias: 'Penicilina', discapacidad: 'Visual leve', enfermedad_cronica: 'Asma' });

    const { rows } = await query('SELECT tipo_sangre, alergias, discapacidad, enfermedad_cronica FROM voluntarios WHERE id = $1', [v.id]);
    for (const valor of Object.values(rows[0])) expect(estaCifrado(valor)).toBe(true);
    expect(JSON.stringify(rows[0])).not.toMatch(/Penicilina|Asma|Visual/);

    const detalle = await request(app).get(`/api/voluntarios/${v.id}`).set(auth());
    expect(detalle.status).toBe(200);
    expect(detalle.body.voluntario).toMatchObject({ tipo_sangre: 'O+', alergias: 'Penicilina', enfermedad_cronica: 'Asma' });
  });

  test('al actualizar se vuelve a cifrar, y vaciar un campo lo deja nulo', async () => {
    const v = await crearVoluntario();
    const r = await request(app).put(`/api/voluntarios/${v.id}`).set(auth()).send({ alergias: 'Polen', discapacidad: null });
    expect(r.status).toBe(200);
    expect(r.body.voluntario.alergias).toBe('Polen');

    const { rows } = await query('SELECT alergias, discapacidad FROM voluntarios WHERE id = $1', [v.id]);
    expect(estaCifrado(rows[0].alergias)).toBe(true);
    expect(rows[0].alergias).not.toMatch(/Polen/);
    expect(rows[0].discapacidad).toBeNull();
  });

  test('una alergia larga (hasta el máximo permitido) cabe cifrada en la columna', async () => {
    const v = await crearVoluntario({ alergias: 'a'.repeat(2000) });
    const detalle = await request(app).get(`/api/voluntarios/${v.id}`).set(auth());
    expect(detalle.body.voluntario.alergias).toHaveLength(2000);
  });

  test('los datos que ya estaban en claro (heredados) se siguen leyendo', async () => {
    const v = await crearVoluntario();
    await query(`UPDATE voluntarios SET alergias = 'Dato antiguo en claro' WHERE id = $1`, [v.id]);
    const detalle = await request(app).get(`/api/voluntarios/${v.id}`).set(auth());
    expect(detalle.body.voluntario.alergias).toBe('Dato antiguo en claro');
  });

  test('la ficha PDF sigue generándose con los datos descifrados', async () => {
    const v = await crearVoluntario();
    const r = await request(app).get(`/api/voluntarios/${v.id}/ficha.pdf`).set(auth());
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/pdf/);
  });
});

describe('Fase 13 — privacidad: consentimientos, derechos ARCO y anonimización', () => {
  const { generarTokenPortal } = require('../../src/utils/jwt');
  let token;
  let tokenCoordinador;
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    ({ access_token: token } = await loginComoAdmin());
    const correo = `coord.privacidad.${Date.now()}@sigevac.local`;
    await request(app).post('/api/usuarios').set(auth()).send({ nombre: 'Coord Privacidad', correo, password: 'Coord#12345', rol: 'coordinador' });
    const login = await request(app).post('/api/auth/login').send({ correo, password: 'Coord#12345' });
    tokenCoordinador = login.body.access_token;
  });

  async function crearVoluntarioCompleto() {
    const r = await request(app).post('/api/voluntarios').set(auth()).send({
      nombre: 'Marisol', apellidoPaterno: 'Anonimizable', apellidoMaterno: 'Prueba', fechaNacimiento: '1996-08-21',
      curp: `ANON${Date.now().toString().slice(-8)}HPLRRR09`.slice(0, 18), sexo: 'F',
      correo: `anon.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`, telefono: '2381112233',
      direccion: 'Calle Falsa 123', colonia: 'Centro', tipoSangre: 'A+', alergias: 'Mariscos', enfermedadCronica: 'Diabetes',
      contactoEmergenciaNombre: 'Madre Prueba', contactoEmergenciaTelefono: '2389998877', consentimientoDatosSensibles: true,
    });
    expect(r.status).toBe(201);
    return r.body.voluntario;
  }

  test('sin el permiso privacidad.gestionar se responde 403, y sin sesión 401', async () => {
    const v = await crearVoluntarioCompleto();
    expect((await request(app).get(`/api/privacidad/voluntarios/${v.id}/datos-personales`)).status).toBe(401);
    expect((await request(app).get(`/api/privacidad/voluntarios/${v.id}/datos-personales`).set(auth(tokenCoordinador))).status).toBe(403);
    expect((await request(app).post(`/api/privacidad/voluntarios/${v.id}/anonimizar`).set(auth(tokenCoordinador)).send({ confirmar: true, motivo: 'x' })).status).toBe(403);
    expect((await request(app).get('/api/privacidad/arco').set(auth(tokenCoordinador))).status).toBe(403);
  });

  test('derecho de acceso: exporta todos los datos del voluntario, descifrados, sin caché', async () => {
    const v = await crearVoluntarioCompleto();
    await request(app).post(`/api/privacidad/voluntarios/${v.id}/consentimientos`).set(auth()).send({ versionAviso: '2026-1', finalidadesSecundarias: true });
    const r = await request(app).get(`/api/privacidad/voluntarios/${v.id}/datos-personales?descargar=1`).set(auth());
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['content-disposition']).toMatch(/attachment/);
    expect(r.body.voluntario).toMatchObject({ nombre: 'Marisol', alergias: 'Mariscos', tipo_sangre: 'A+', enfermedad_cronica: 'Diabetes' });
    expect(r.body.voluntario).not.toHaveProperty('fotografia_url');
    expect(r.body.consentimientos.filter((c) => c.tipo === 'aviso')).toHaveLength(1);
    expect(r.body.consentimientos.some((c) => c.tipo === 'datos_sensibles')).toBe(true); // se registró al guardar los datos de salud
    expect(Array.isArray(r.body.documentos)).toBe(true);
    expect((await request(app).get('/api/privacidad/voluntarios/00000000-0000-0000-0000-000000000000/datos-personales').set(auth())).status).toBe(404);
  });

  test('consentimientos: se registran con validación, se listan y se revocan conservando la constancia', async () => {
    const v = await crearVoluntarioCompleto();
    const base = `/api/privacidad/voluntarios/${v.id}/consentimientos`;
    expect((await request(app).post(base).set(auth()).send({})).status).toBe(400);
    expect((await request(app).post(base).set(auth()).send({ versionAviso: '2026-1', medio: 'telepatia' })).status).toBe(400);
    expect((await request(app).post(base).set(auth()).send({ versionAviso: '2026-1', finalidadesSecundarias: 'si' })).status).toBe(400);
    const ok = await request(app).post(base).set(auth()).send({ versionAviso: '2026-1', finalidadesSecundarias: true, medio: 'portal' });
    expect(ok.status).toBe(201);
    const id = ok.body.consentimiento.id;

    const revocado = await request(app).patch(`${base}/${id}/revocar`).set(auth());
    expect(revocado.status).toBe(200);
    expect(revocado.body.consentimiento.revocado_en).toBeTruthy();
    expect((await request(app).patch(`${base}/${id}/revocar`).set(auth())).status).toBe(404); // ya revocado
    const lista = await request(app).get(base).set(auth());
    expect(lista.body.consentimientos.filter((c) => c.tipo === 'aviso')).toHaveLength(1); // la constancia sigue ahí
  });

  test('derecho de cancelación: exige confirmación y motivo; borra datos personales y conserva estadísticas', async () => {
    const v = await crearVoluntarioCompleto();
    await request(app).post(`/api/voluntarios/${v.id}/credencial`).set(auth()).send({});
    const url = `/api/privacidad/voluntarios/${v.id}/anonimizar`;

    expect((await request(app).post(url).set(auth()).send({})).status).toBe(400);
    expect((await request(app).post(url).set(auth()).send({ confirmar: true })).status).toBe(400);
    expect((await request(app).post(url).set(auth()).send({ confirmar: 'true', motivo: 'x' })).status).toBe(400);
    expect((await request(app).get(`/api/voluntarios/${v.id}`).set(auth())).body.voluntario.nombre).toBe('Marisol'); // nada cambió

    const r = await request(app).post(url).set(auth()).send({ confirmar: true, motivo: 'Solicitud ARCO de cancelación' });
    expect(r.status).toBe(200);

    const { rows } = await query('SELECT * FROM voluntarios WHERE id = $1', [v.id]);
    const fila = rows[0];
    expect(fila.nombre).toBe('Persona anonimizada');
    for (const col of ['apellido_paterno', 'apellido_materno', 'curp', 'sexo', 'correo', 'telefono', 'direccion', 'colonia',
      'tipo_sangre', 'alergias', 'enfermedad_cronica', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono']) {
      expect(fila[col]).toBeNull();
    }
    expect(fila.activo).toBe(false);
    expect(fila.anonimizado_en).toBeTruthy();
    expect(String(fila.fecha_nacimiento)).toBe('1996-01-01'); // solo se conserva el año
    expect((await query('SELECT 1 FROM qr_codigos WHERE voluntario_id = $1', [v.id])).rows).toHaveLength(0);
    expect((await query('SELECT 1 FROM expedientes WHERE voluntario_id = $1', [v.id])).rows).toHaveLength(0);

    // No se puede anonimizar dos veces
    expect((await request(app).post(url).set(auth()).send({ confirmar: true, motivo: 'otra vez' })).status).toBe(409);
  });

  test('la anonimización borra también la solicitud pública original (mismo correo) y los archivos', async () => {
    const correo = `solicitud.anon.${Date.now()}@example.com`;
    const alta = await request(app).post('/api/voluntarios').set(auth()).send({ nombre: 'Con Solicitud', fechaNacimiento: '1990-01-01', correo });
    const { rows: [{ asociacion_id: asociacionId }] } = await query('SELECT asociacion_id FROM voluntarios WHERE id = $1', [alta.body.voluntario.id]);
    await request(app).post('/api/solicitudes').send({ asociacion_id: asociacionId, nombre: 'Con Solicitud', correo, acepta_aviso_privacidad: true });
    expect((await query('SELECT 1 FROM solicitudes_voluntariado WHERE correo = $1', [correo])).rows).toHaveLength(1);

    await request(app).post(`/api/privacidad/voluntarios/${alta.body.voluntario.id}/anonimizar`).set(auth()).send({ confirmar: true, motivo: 'Prueba' });
    expect((await query('SELECT 1 FROM solicitudes_voluntariado WHERE correo = $1', [correo])).rows).toHaveLength(0);
  });

  test('un enlace de portal aún vigente deja de funcionar cuando el voluntario fue anonimizado', async () => {
    const v = await crearVoluntarioCompleto();
    const tokenPortal = generarTokenPortal(v.id);
    expect((await request(app).get('/api/portal/expediente').set(auth(tokenPortal))).status).toBe(200);
    await request(app).post(`/api/privacidad/voluntarios/${v.id}/anonimizar`).set(auth()).send({ confirmar: true, motivo: 'Prueba portal' });
    expect((await request(app).get('/api/portal/expediente').set(auth(tokenPortal))).status).toBe(401);
  });

  test('aislamiento: no se puede exportar ni anonimizar un voluntario de OTRA asociación', async () => {
    const { rows: [aso] } = await query(`INSERT INTO asociaciones (nombre) VALUES ('Otra AC de prueba privacidad') RETURNING id`);
    const { rows: [ajeno] } = await query(
      `INSERT INTO voluntarios (asociacion_id, nombre, fecha_nacimiento, numero_voluntario) VALUES ($1, 'Ajeno', '1990-05-05', $2) RETURNING id`,
      [aso.id, `AJ-${Date.now()}`]
    );
    for (const [metodo, ruta, cuerpo] of [
      ['get', `/api/privacidad/voluntarios/${ajeno.id}/datos-personales`], ['get', `/api/privacidad/voluntarios/${ajeno.id}/consentimientos`],
      ['post', `/api/privacidad/voluntarios/${ajeno.id}/anonimizar`, { confirmar: true, motivo: 'x' }],
    ]) {
      const r = await request(app)[metodo](ruta).set(auth()).send(cuerpo);
      expect([403, 404]).toContain(r.status);
    }
    expect((await query('SELECT nombre FROM voluntarios WHERE id = $1', [ajeno.id])).rows[0].nombre).toBe('Ajeno');
  });

  test('solicitudes ARCO: se registran, listan con alerta de vencimiento y se resuelven', async () => {
    const v = await crearVoluntarioCompleto();
    expect((await request(app).post('/api/privacidad/arco').set(auth()).send({ tipo: 'borrar_todo' })).status).toBe(400);
    expect((await request(app).post('/api/privacidad/arco').set(auth()).send({ tipo: 'acceso', voluntarioId: 'no-es-uuid' })).status).toBe(400);
    expect((await request(app).post('/api/privacidad/arco').set(auth()).send({ tipo: 'acceso', voluntarioId: '00000000-0000-0000-0000-000000000000' })).status).toBe(404);

    const creada = await request(app).post('/api/privacidad/arco').set(auth()).send({ tipo: 'rectificacion', voluntarioId: v.id, detalle: 'Corregir mi teléfono' });
    expect(creada.status).toBe(201);
    expect(creada.body.solicitud.estado).toBe('recibida');
    const id = creada.body.solicitud.id;

    await query(`UPDATE solicitudes_arco SET fecha_limite = CURRENT_DATE - 1 WHERE id = $1`, [id]);
    const lista = await request(app).get('/api/privacidad/arco?estado=recibida').set(auth());
    expect(lista.body.solicitudes.find((s) => s.id === id)).toMatchObject({ vencida: true, tipo: 'rectificacion' });
    expect((await request(app).get('/api/privacidad/arco?estado=inventado').set(auth())).status).toBe(400);

    expect((await request(app).patch(`/api/privacidad/arco/${id}`).set(auth()).send({ estado: 'hecho' })).status).toBe(400);
    const resuelta = await request(app).patch(`/api/privacidad/arco/${id}`).set(auth()).send({ estado: 'atendida', resolucion: 'Teléfono actualizado' });
    expect(resuelta.status).toBe(200);
    expect(resuelta.body.solicitud).toMatchObject({ estado: 'atendida', resolucion: 'Teléfono actualizado' });
    expect(resuelta.body.solicitud.atendida_en).toBeTruthy();
    expect((await request(app).patch('/api/privacidad/arco/00000000-0000-0000-0000-000000000000').set(auth()).send({ estado: 'atendida' })).status).toBe(404);
  });

  test('la auditoría NO guarda en claro los datos personales sensibles al crear y editar un voluntario', async () => {
    const r = await request(app).post('/api/voluntarios').set(auth()).send({
      nombre: 'Auditada', fechaNacimiento: '1991-02-02', alergias: 'ALERGIA-SECRETA', enfermedadCronica: 'ENFERMEDAD-SECRETA',
      curp: 'AUDI910202HPLRRR09', telefono: '2387654321', consentimientoDatosSensibles: true,
    });
    expect(r.status).toBe(201);
    await request(app).put(`/api/voluntarios/${r.body.voluntario.id}`).set(auth()).send({ alergias: 'OTRA-ALERGIA-SECRETA', direccion: 'DOMICILIO-SECRETO' });

    // La auditoría se escribe al terminar la respuesta (sin bloquearla): se espera a que aparezca.
    let filas = [];
    for (let i = 0; i < 30 && filas.length < 2; i += 1) {
      await new Promise((res) => setTimeout(res, 100));
      ({ rows: filas } = await query(
        `SELECT detalle::text AS d FROM auditoria WHERE entidad_id = $1 OR accion = 'POST /api/voluntarios' ORDER BY creado_en DESC LIMIT 5`,
        [r.body.voluntario.id]
      ));
    }
    expect(filas.length).toBeGreaterThanOrEqual(2);
    const todo = filas.map((f) => f.d).join(' ');
    expect(todo).not.toMatch(/SECRETA|SECRETO|AUDI910202|2387654321/);
    expect(todo).toMatch(/Auditada/); // el nombre sí queda: sirve para saber qué registro se tocó
  });

  test('retención: lista bajas antiguas con datos personales sin tocarlas, y valida el parámetro', async () => {
    const v = await crearVoluntarioCompleto();
    await query(`UPDATE voluntarios SET activo = false, fecha_baja = CURRENT_DATE - interval '8 years' WHERE id = $1`, [v.id]);
    const r = await request(app).get('/api/privacidad/retencion/candidatos?anios=5').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.candidatos.some((c) => c.id === v.id)).toBe(true);
    expect((await request(app).get('/api/privacidad/retencion/candidatos?anios=10').set(auth())).body.candidatos.some((c) => c.id === v.id)).toBe(false);
    expect((await request(app).get('/api/privacidad/retencion/candidatos?anios=abc').set(auth())).status).toBe(400);
    expect((await request(app).get('/api/privacidad/retencion/candidatos').set(auth(tokenCoordinador))).status).toBe(403);
    expect((await query('SELECT anonimizado_en FROM voluntarios WHERE id = $1', [v.id])).rows[0].anonimizado_en).toBeNull(); // no se anonimiza solo

    await request(app).post(`/api/privacidad/voluntarios/${v.id}/anonimizar`).set(auth()).send({ confirmar: true, motivo: 'Depuración' });
    expect((await request(app).get('/api/privacidad/retencion/candidatos?anios=5').set(auth())).body.candidatos.some((c) => c.id === v.id)).toBe(false);
  });
});
