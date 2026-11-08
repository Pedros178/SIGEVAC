const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

/** El día hábil número `n` (lunes a viernes) después de `iso` (YYYY-MM-DD), calculado en JS de forma independiente al SQL. */
function sumarHabiles(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  let contados = 0;
  while (contados < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) contados += 1;
  }
  return d.toISOString().slice(0, 10);
}
const hoyBD = async () => (await query(`SELECT CURRENT_DATE::text AS f`)).rows[0].f;
const f = (valor) => String(valor).slice(0, 10);

describe('Fase 14 — Ley Federal de Protección de Datos Personales en Posesión de los Particulares (2025)', () => {
  let token;
  let tokenCoordinador;
  let asociacionId;
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });
  const correo = (p) => `${p}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;

  beforeAll(async () => {
    ({ access_token: token } = await loginComoAdmin());
    const c = correo('coord.ley');
    await request(app).post('/api/usuarios').set(auth()).send({ nombre: 'Coord Ley', correo: c, password: 'Coord#12345', rol: 'coordinador' });
    tokenCoordinador = (await request(app).post('/api/auth/login').send({ correo: c, password: 'Coord#12345' })).body.access_token;
    ({ rows: [{ id: asociacionId }] } = await query('SELECT id FROM asociaciones ORDER BY creado_en LIMIT 1'));
  });

  describe('Art. 8 — datos sensibles: consentimiento expreso y por escrito', () => {
    const base = () => ({ nombre: 'Consent', fechaNacimiento: '1993-04-04', correo: correo('consent') });

    test('guardar datos de salud SIN consentimiento se rechaza (400) y no se crea el voluntario', async () => {
      const datos = { ...base(), alergias: 'Polen', tipoSangre: 'O+' };
      const r = await request(app).post('/api/voluntarios').set(auth()).send(datos);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('CONSENTIMIENTO_DATOS_SENSIBLES_REQUERIDO');
      expect((await query('SELECT 1 FROM voluntarios WHERE correo = $1', [datos.correo])).rows).toHaveLength(0);
      for (const falso of ['true', 1, 'si']) {
        expect((await request(app).post('/api/voluntarios').set(auth()).send({ ...datos, consentimientoDatosSensibles: falso })).status).toBe(400);
      }
    });

    test('"Ninguna", "N/A" o campos vacíos no son datos de salud y no exigen consentimiento', async () => {
      const r = await request(app).post('/api/voluntarios').set(auth()).send({ ...base(), discapacidad: 'Ninguna', enfermedadCronica: 'N/A', alergias: '  ' });
      expect(r.status).toBe(201);
      expect((await query(`SELECT 1 FROM consentimientos_privacidad WHERE voluntario_id = $1`, [r.body.voluntario.id])).rows).toHaveLength(0);
    });

    test('con consentimiento se guarda y queda registrado: tipo, versión, medio y quién lo otorgó', async () => {
      const r = await request(app).post('/api/voluntarios').set(auth()).send({ ...base(), alergias: 'Polen', consentimientoDatosSensibles: true, medioConsentimiento: 'firma_electronica' });
      expect(r.status).toBe(201);
      expect(r.body.voluntario.consentimiento_datos_sensibles).toBe(true);
      const { rows } = await query(`SELECT * FROM consentimientos_privacidad WHERE voluntario_id = $1`, [r.body.voluntario.id]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ tipo: 'datos_sensibles', medio: 'firma_electronica', otorgado_por: 'titular' });
      expect(rows[0].version_aviso).toBeTruthy();
    });

    test('si el voluntario es menor de edad, el consentimiento lo otorga el tutor', async () => {
      const anio = new Date().getUTCFullYear() - 12;
      const r = await request(app).post('/api/voluntarios').set(auth()).send({
        nombre: 'Menor', fechaNacimiento: `${anio}-06-15`, correo: correo('menor'), alergias: 'Nueces', consentimientoDatosSensibles: true,
        tutor: { nombre: 'Tutora Prueba', telefono: '2381112222', parentesco: 'madre' },
      });
      expect(r.status).toBe(201);
      expect((await query(`SELECT otorgado_por FROM consentimientos_privacidad WHERE voluntario_id = $1`, [r.body.voluntario.id])).rows[0].otorgado_por).toBe('tutor');
    });

    test('al editar: agregar datos de salud a quien no dio consentimiento exige darlo; con uno vigente ya no se vuelve a pedir ni se duplica', async () => {
      const v = (await request(app).post('/api/voluntarios').set(auth()).send(base())).body.voluntario;
      const url = `/api/voluntarios/${v.id}`;
      const sin = await request(app).put(url).set(auth()).send({ alergias: 'Polen' });
      expect(sin.status).toBe(400);
      expect(sin.body.code).toBe('CONSENTIMIENTO_DATOS_SENSIBLES_REQUERIDO');
      expect((await request(app).put(url).set(auth()).send({ alergias: 'Polen', consentimientoDatosSensibles: true })).status).toBe(200);
      expect((await request(app).put(url).set(auth()).send({ alergias: 'Polen y ácaros' })).status).toBe(200); // ya hay consentimiento vigente
      expect((await request(app).put(url).set(auth()).send({ alergias: 'Polen', consentimientoDatosSensibles: true })).status).toBe(200);
      expect((await query(`SELECT 1 FROM consentimientos_privacidad WHERE voluntario_id = $1 AND tipo = 'datos_sensibles'`, [v.id])).rows).toHaveLength(1);
    });

    test('art. 7: revocar el consentimiento de datos sensibles hace cesar el tratamiento (borra los datos de salud) y vuelve a exigirlo', async () => {
      const v = (await request(app).post('/api/voluntarios').set(auth()).send({ ...base(), alergias: 'Polen', tipoSangre: 'A+', consentimientoDatosSensibles: true })).body.voluntario;
      const { rows: [c] } = await query(`SELECT id FROM consentimientos_privacidad WHERE voluntario_id = $1`, [v.id]);
      const r = await request(app).patch(`/api/privacidad/voluntarios/${v.id}/consentimientos/${c.id}/revocar`).set(auth());
      expect(r.status).toBe(200);
      expect(r.body.consentimiento.datos_sensibles_eliminados).toBe(true);
      expect((await query(`SELECT alergias, tipo_sangre FROM voluntarios WHERE id = $1`, [v.id])).rows[0]).toEqual({ alergias: null, tipo_sangre: null });
      expect((await request(app).put(`/api/voluntarios/${v.id}`).set(auth()).send({ alergias: 'Otra' })).status).toBe(400);
    });

    test('revocar un consentimiento que NO es de datos sensibles no borra los datos de salud', async () => {
      const v = (await request(app).post('/api/voluntarios').set(auth()).send({ ...base(), alergias: 'Polen', consentimientoDatosSensibles: true })).body.voluntario;
      const reg = await request(app).post(`/api/privacidad/voluntarios/${v.id}/consentimientos`).set(auth()).send({ versionAviso: '2026-1', tipo: 'finalidades_secundarias' });
      expect(reg.status).toBe(201);
      const r = await request(app).patch(`/api/privacidad/voluntarios/${v.id}/consentimientos/${reg.body.consentimiento.id}/revocar`).set(auth());
      expect(r.body.consentimiento.datos_sensibles_eliminados).toBe(false);
      expect((await query(`SELECT alergias FROM voluntarios WHERE id = $1`, [v.id])).rows[0].alergias).not.toBeNull();
    });

    test('el tipo y el otorgante del consentimiento se validan', async () => {
      const v = (await request(app).post('/api/voluntarios').set(auth()).send(base())).body.voluntario;
      const url = `/api/privacidad/voluntarios/${v.id}/consentimientos`;
      expect((await request(app).post(url).set(auth()).send({ versionAviso: '1', tipo: 'inventado' })).status).toBe(400);
      expect((await request(app).post(url).set(auth()).send({ versionAviso: '1', otorgadoPor: 'vecino' })).status).toBe(400);
    });
  });

  describe('Art. 31 — plazos de las solicitudes ARCO (días hábiles)', () => {
    async function crearArco(extra = {}) {
      const r = await request(app).post('/api/privacidad/arco').set(auth()).send({ tipo: 'acceso', ...extra });
      expect(r.status).toBe(201);
      return r.body.solicitud;
    }

    test('la fecha límite de respuesta es a 20 días HÁBILES (no naturales)', async () => {
      const s = await crearArco();
      expect(f(s.fecha_limite)).toBe(sumarHabiles(await hoyBD(), 20));
    });

    test('se puede ampliar UNA sola vez, por otros 20 días hábiles; una cerrada no se amplía', async () => {
      const s = await crearArco();
      const antes = f(s.fecha_limite);
      const r = await request(app).patch(`/api/privacidad/arco/${s.id}/ampliar`).set(auth());
      expect(r.status).toBe(200);
      expect(r.body.solicitud.ampliada).toBe(true);
      expect(f(r.body.solicitud.fecha_limite)).toBe(sumarHabiles(antes, 20));
      expect((await request(app).patch(`/api/privacidad/arco/${s.id}/ampliar`).set(auth())).status).toBe(409);

      const cerrada = await crearArco();
      await request(app).patch(`/api/privacidad/arco/${cerrada.id}`).set(auth()).send({ estado: 'atendida' });
      expect((await request(app).patch(`/api/privacidad/arco/${cerrada.id}/ampliar`).set(auth())).status).toBe(409);
      expect((await request(app).patch('/api/privacidad/arco/no-uuid/ampliar').set(auth())).status).toBe(400);
      expect((await request(app).patch(`/api/privacidad/arco/${s.id}/ampliar`).set(auth(tokenCoordinador))).status).toBe(403);
    });

    test('al comunicar la determinación (en_proceso) corren 15 días hábiles para ejecutarla, y se alerta si vence', async () => {
      const s = await crearArco();
      const r = await request(app).patch(`/api/privacidad/arco/${s.id}`).set(auth()).send({ estado: 'en_proceso', resolucion: 'Procedente' });
      expect(f(r.body.solicitud.fecha_limite_ejecucion)).toBe(sumarHabiles(await hoyBD(), 15));
      await query(`UPDATE solicitudes_arco SET fecha_limite_ejecucion = CURRENT_DATE - 1 WHERE id = $1`, [s.id]);
      const lista = await request(app).get('/api/privacidad/arco?estado=en_proceso').set(auth());
      expect(lista.body.solicitudes.find((x) => x.id === s.id).vencida).toBe(true);
    });

    test('art. 24: se deja constancia de que se avisó a la persona titular de la cancelación', async () => {
      const s = await crearArco({ tipo: 'cancelacion' });
      expect(s.titular_notificado_en).toBeNull();
      const r = await request(app).patch(`/api/privacidad/arco/${s.id}`).set(auth()).send({ estado: 'atendida', resolucion: 'Datos cancelados', notificadoTitular: true });
      expect(r.body.solicitud.titular_notificado_en).toBeTruthy();
    });
  });

  describe('Art. 15 y 16 — aviso de privacidad configurable y público', () => {
    test('el aviso público indica si está completo; la asociación lo configura y aparece sin necesidad de sesión', async () => {
      const url = `/api/publico/aviso-privacidad?asociacion_id=${asociacionId}`;
      await query(`DELETE FROM configuracion WHERE asociacion_id = $1 AND clave LIKE 'privacidad.%'`, [asociacionId]);
      const vacio = await request(app).get(url);
      expect(vacio.status).toBe(200);
      expect(vacio.body.aviso.completo).toBe(false);
      expect(vacio.body.aviso.responsable).toBeTruthy();
      expect(vacio.body.aviso.version_aviso).toBeTruthy();

      const guardado = await request(app).put('/api/privacidad/aviso').set(auth()).send({
        domicilio: 'Calle Falsa 123, Tehuacán, Puebla', correo_arco: 'arco@asociacion.org', persona_designada: 'María Pérez', version_aviso: '2026-2',
      });
      expect(guardado.status).toBe(200);
      const completo = await request(app).get(url);
      expect(completo.body.aviso).toMatchObject({ completo: true, domicilio: 'Calle Falsa 123, Tehuacán, Puebla', correo_arco: 'arco@asociacion.org', version_aviso: '2026-2' });
    });

    test('validaciones y permisos al configurar el aviso', async () => {
      expect((await request(app).put('/api/privacidad/aviso').set(auth()).send({})).status).toBe(400);
      expect((await request(app).put('/api/privacidad/aviso').set(auth()).send({ correo_arco: 'no-es-correo' })).status).toBe(400);
      expect((await request(app).put('/api/privacidad/aviso').set(auth()).send({ domicilio: 'x'.repeat(501) })).status).toBe(400);
      expect((await request(app).put('/api/privacidad/aviso').set(auth()).send({ domicilio: 123 })).status).toBe(400);
      expect((await request(app).put('/api/privacidad/aviso').set(auth(tokenCoordinador)).send({ domicilio: 'x' })).status).toBe(403);
      expect((await request(app).put('/api/privacidad/aviso').send({ domicilio: 'x' })).status).toBe(401);
      expect((await request(app).get('/api/publico/aviso-privacidad?asociacion_id=no-uuid')).status).toBe(400);
      expect((await request(app).get('/api/publico/aviso-privacidad?asociacion_id=00000000-0000-0000-0000-000000000000')).status).toBe(404);
    });

    test('la solicitud pública guarda la versión del aviso configurada por la asociación; asociacion_id inválido responde 400', async () => {
      await request(app).put('/api/privacidad/aviso').set(auth()).send({ version_aviso: '2027-1' });
      const c = correo('versionaviso');
      const r = await request(app).post('/api/solicitudes').send({ asociacion_id: asociacionId, nombre: 'Aspirante', correo: c, acepta_aviso_privacidad: true });
      expect(r.status).toBe(201);
      expect(r.body.solicitud.version_aviso).toBe('2027-1');
      expect((await request(app).post('/api/solicitudes').send({ asociacion_id: 'x', nombre: 'A', correo: c, acepta_aviso_privacidad: true })).status).toBe(400);
    });
  });
});
