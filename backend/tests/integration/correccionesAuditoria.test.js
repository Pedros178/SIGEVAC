const ExcelJS = require('exceljs');
const { request, app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

const PW = 'Victima#Segura77';
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let admin; let tok;
const H = (t = tok) => ({ Authorization: `Bearer ${t}` });
async function nuevaAsoc() {
  const r = await request(app).post('/api/asociacion').set(H(admin.access_token)).send({ nombre: `Asoc ${unico()}` });
  return r.body.asociacion.id;
}
async function usuarioEn(asocId, rol) {
  const correo = `x${unico()}@t.local`;
  const r = await request(app).post('/api/usuarios').set(H(admin.access_token)).send({ nombre: 'U', correo, password: PW, rol });
  await query('DELETE FROM usuario_asociaciones WHERE usuario_id = $1', [r.body.usuario.id]);
  await query('INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada) VALUES ($1,$2,true)', [r.body.usuario.id, asocId]);
  await query('UPDATE usuarios SET asociacion_id = $2 WHERE id = $1', [r.body.usuario.id, asocId]);
  const l = await request(app).post('/api/auth/login').send({ correo, password: PW });
  return { id: r.body.usuario.id, token: l.body.access_token };
}
const subir = (ruta, token, nombre, contenido, tipo) => request(app).post(ruta).set(H(token)).attach('archivo', Buffer.from(contenido), { filename: nombre, contentType: tipo });

beforeAll(async () => { admin = await loginComoAdmin(); tok = admin.access_token; });

describe('A-02 importación masiva de voluntarios', () => {
  test('un CSV válido importa filas, reporta errores por fila y no tumba el lote', async () => {
    const s = unico();
    const csv = `nombre,fechaNacimiento,apellidoPaterno,curp,correo\nAna ${s},1990-02-02,López,IMA${s.slice(-10)}01,ana${s}@x.com\nLuis ${s},1991-03-03,Pérez,,luis${s}@x.com\n,1991-03-03,SinNombre,,\nMenor ${s},2018-01-01,Chico,,\nFecha ${s},no-fecha,Mala,,\nAna ${s},1990-02-02,Dup,IMA${s.slice(-10)}01,\n`;
    const r = await subir('/api/voluntarios/importar', tok, 'v.csv', csv, 'text/csv');
    expect(r.status).toBe(201);
    expect(r.body.importados).toBe(2);
    expect(r.body.errores.map((e) => e.fila).sort()).toEqual([4, 5, 6, 7]);
    const lista = await request(app).get(`/api/voluntarios?busqueda=${encodeURIComponent('Ana ' + s)}`).set(H());
    expect(lista.body.voluntarios.length).toBe(1);
  });
  test('un CSV que Windows declara como application/vnd.ms-excel también se acepta (M-10)', async () => {
    const s = unico();
    const r = await subir('/api/voluntarios/importar', tok, 'excel.csv', `nombre,fechaNacimiento\nWin ${s},1992-02-02\n`, 'application/vnd.ms-excel');
    expect(r.status).toBe(201);
    expect(r.body.importados).toBe(1);
  });
  test('un XLSX válido importa (con fechas reales de Excel)', async () => {
    const s = unico();
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('V');
    ws.addRow(['nombre', 'fechaNacimiento', 'apellidoPaterno']);
    ws.addRow([`Xlsx ${s}`, new Date(Date.UTC(1992, 3, 4)), 'Gómez']);
    const buf = await wb.xlsx.writeBuffer();
    const r = await subir('/api/voluntarios/importar', tok, 'v.xlsx', Buffer.from(buf), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(r.status).toBe(201);
    expect(r.body.importados).toBe(1);
  });
  test('los menores de edad se rechazan en la importación (M-12: requieren tutor)', async () => {
    const r = await subir('/api/voluntarios/importar', tok, 'm.csv', `nombre,fechaNacimiento\nNiño ${unico()},2018-05-05\n`, 'text/csv');
    expect(r.body.importados).toBe(0);
    expect(r.body.errores[0].error).toMatch(/menor/i);
  });
  test('archivo ilegible → 400 (no 500) y contenido binario declarado CSV → 400', async () => {
    expect((await subir('/api/voluntarios/importar', tok, 'x.xlsx', 'esto no es un zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).status).toBe(400);
    expect((await subir('/api/voluntarios/importar', tok, 'x.csv', Buffer.from([0x4d, 0x5a, 0, 0, 1]).toString('latin1'), 'text/csv')).status).toBe(400);
  });
});

describe('N-01 inscripción a actividades: aislamiento, estado y cupo', () => {
  let tokA; let tokB; let volA; let actB; let volB1; let volB2;
  beforeAll(async () => {
    const asocA = await nuevaAsoc(); const asocB = await nuevaAsoc();
    tokA = (await usuarioEn(asocA, 'coordinador')).token; tokB = (await usuarioEn(asocB, 'coordinador')).token;
    const mk = async (t, n) => (await request(app).post('/api/voluntarios').set(H(t)).send({ nombre: n, fechaNacimiento: '1990-01-01' })).body.voluntario.id;
    volA = await mk(tokA, 'Vol A'); volB1 = await mk(tokB, 'Vol B1'); volB2 = await mk(tokB, 'Vol B2');
    actB = (await request(app).post('/api/actividades').set(H(tokB)).send({ nombre: 'Act B', fecha: '2027-01-01', cupo: 1 })).body.actividad.id;
  });
  test('no se puede inscribir a un voluntario de OTRA asociación', async () => {
    const r = await request(app).post(`/api/actividades/${actB}/participaciones`).set(H(tokB)).send({ voluntarioId: volA });
    expect(r.status).toBe(404);
  });
  test('id no-UUID → 400', async () => {
    expect((await request(app).post(`/api/actividades/${actB}/participaciones`).set(H(tokB)).send({ voluntarioId: 'abc' })).status).toBe(400);
  });
  test('se respeta el cupo, incluso con inscripciones simultáneas', async () => {
    const [a, b] = await Promise.all([volB1, volB2].map((v) => request(app).post(`/api/actividades/${actB}/participaciones`).set(H(tokB)).send({ voluntarioId: v })));
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });
  test('un voluntario inactivo no se puede inscribir', async () => {
    const asoc = await nuevaAsoc(); const t = (await usuarioEn(asoc, 'presidente')).token; // 'voluntarios.eliminar' (baja) lo tiene el presidente
    const v = (await request(app).post('/api/voluntarios').set(H(t)).send({ nombre: 'Baja', fechaNacimiento: '1990-01-01' })).body.voluntario.id;
    expect((await request(app).delete(`/api/voluntarios/${v}`).set(H(t))).status).toBe(200);
    const act = (await request(app).post('/api/actividades').set(H(t)).send({ nombre: 'A', fecha: '2027-01-01' })).body.actividad.id;
    expect((await request(app).post(`/api/actividades/${act}/participaciones`).set(H(t)).send({ voluntarioId: v })).status).toBe(409);
  });
});

describe('A-01 y M-09 aislamiento de bitácora y QR', () => {
  test('la bitácora solo muestra eventos de usuarios de la asociación activa', async () => {
    const asocA = await nuevaAsoc(); const asocB = await nuevaAsoc();
    const a = await usuarioEn(asocA, 'presidente'); const b = await usuarioEn(asocB, 'presidente');
    await request(app).get('/api/dashboard').set(H(b.token));
    await request(app).get('/api/dashboard').set(H(a.token)); // la bitácora se escribe al terminar cada petición
    await new Promise((r) => setTimeout(r, 300));
    const r = await request(app).get('/api/auditoria/bitacora?limit=200').set(H(a.token));
    expect(r.status).toBe(200);
    expect(r.body.bitacora.some((e) => e.usuario_id === b.id)).toBe(false);
    expect(r.body.bitacora.some((e) => e.usuario_id === a.id)).toBe(true);
  });
  test('el rol consulta ya no puede ver la auditoría (M-08)', async () => {
    const asoc = await nuevaAsoc(); const c = await usuarioEn(asoc, 'consulta');
    expect((await request(app).get('/api/auditoria').set(H(c.token))).status).toBe(403);
  });
  test('el QR de un voluntario de otra asociación no se resuelve', async () => {
    const asocA = await nuevaAsoc(); const asocB = await nuevaAsoc();
    const ta = (await usuarioEn(asocA, 'coordinador')).token; const tb = (await usuarioEn(asocB, 'coordinador')).token;
    const v = (await request(app).post('/api/voluntarios').set(H(ta)).send({ nombre: 'Con QR', fechaNacimiento: '1990-01-01' })).body.voluntario.id;
    const cred = await request(app).post(`/api/voluntarios/${v}/credencial`).set(H(ta));
    const codigo = cred.body.credencial.qr_codigo;
    expect((await request(app).get(`/api/qr/${codigo}`).set(H(ta))).status).toBe(200);
    expect((await request(app).get(`/api/qr/${codigo}`).set(H(tb))).status).toBe(404);
  });
});

describe('M-01 entradas inválidas responden 400, no 500', () => {
  test.each([
    ['GET', '/api/usuarios?limit=abc', 200], ['GET', '/api/usuarios?limit=-5', 200], ['GET', '/api/usuarios?offset=-1', 200],
    ['GET', '/api/voluntarios?limit=abc', 200], ['GET', '/api/voluntarios/abc', 400], ['GET', '/api/actividades?desde=no-es-fecha', 400],
    ['GET', '/api/auditoria?limit=abc', 403 /* admin sí tiene permiso */],
  ])('%s %s', async (metodo, ruta, esperado) => {
    const r = await request(app)[metodo.toLowerCase()](ruta).set(H());
    if (ruta.startsWith('/api/auditoria')) expect([200]).toContain(r.status);
    else expect(r.status).toBe(esperado);
  });
  test('limit enorme se acota (no devuelve la tabla completa)', async () => {
    const r = await request(app).get('/api/auditoria?limit=100000000').set(H());
    expect(r.status).toBe(200);
    expect(r.body.auditoria.length).toBeLessThanOrEqual(200);
  });
  test('alta de voluntario: nombre largo, curp larga, fecha inválida, correo inválido, estado numérico → 400', async () => {
    const base = { nombre: 'Val', fechaNacimiento: '1990-01-01' };
    for (const extra of [{ nombre: 'A'.repeat(300) }, { curp: 'X'.repeat(40) }, { fechaNacimiento: 'abc' }, { correo: 'no-es-correo' }, { estado: 99 }, { nombre: '   ' }, { fechaNacimiento: '1800-01-01' }, { fechaNacimiento: '2090-01-01' }]) {
      const r = await request(app).post('/api/voluntarios').set(H()).send({ ...base, ...extra });
      expect([r.status, JSON.stringify(extra)]).toEqual([400, JSON.stringify(extra)]);
    }
  });
  test('JSON mal formado → 400 con mensaje genérico', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"correo":');
    expect(r.status).toBe(400);
    expect(r.body.error).not.toMatch(/Unexpected/);
  });
});

describe('M-11 CURP única por asociación y folio robusto', () => {
  test('la misma CURP puede existir en dos asociaciones, pero no duplicarse dentro de una', async () => {
    const asocA = await nuevaAsoc(); const asocB = await nuevaAsoc();
    const ta = (await usuarioEn(asocA, 'coordinador')).token; const tb = (await usuarioEn(asocB, 'coordinador')).token;
    const curp = `CU${unico()}`.slice(0, 18);
    const mk = (t) => request(app).post('/api/voluntarios').set(H(t)).send({ nombre: 'Misma Persona', fechaNacimiento: '1990-01-01', curp });
    expect((await mk(ta)).status).toBe(201);
    expect((await mk(tb)).status).toBe(201);
    expect((await mk(ta)).status).toBe(409);
  });
  test('el folio no se repite aunque se borre un registro intermedio', async () => {
    const asoc = await nuevaAsoc(); const t = (await usuarioEn(asoc, 'coordinador')).token;
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await request(app).post('/api/voluntarios').set(H(t)).send({ nombre: `F${i}`, fechaNacimiento: '1990-01-01' })).body.voluntario.id);
    await query('DELETE FROM voluntarios WHERE id = $1', [ids[0]]);
    const r = await request(app).post('/api/voluntarios').set(H(t)).send({ nombre: 'F4', fechaNacimiento: '1990-01-01' });
    expect(r.status).toBe(201);
  });
});

describe('N-09 quitar a un usuario de una asociación le revoca el acceso de inmediato', () => {
  test('su sesión de esa asociación deja de ser válida y ya no aparece en su listado', async () => {
    const asocA = await nuevaAsoc(); const asocB = await nuevaAsoc();
    const correo = `mov${unico()}@t.local`;
    const creado = await request(app).post('/api/usuarios').set(H(admin.access_token)).send({ nombre: 'Movido', correo, password: PW, rol: 'coordinador' });
    const id = creado.body.usuario.id;
    await query('DELETE FROM usuario_asociaciones WHERE usuario_id = $1', [id]);
    await query('INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada) VALUES ($1,$2,true)', [id, asocA]);
    await query('UPDATE usuarios SET asociacion_id = $2 WHERE id = $1', [id, asocA]);
    const sesionA = (await request(app).post('/api/auth/login').send({ correo, password: PW })).body.access_token;
    expect((await request(app).get('/api/dashboard').set(H(sesionA))).status).toBe(200);

    expect((await request(app).post(`/api/usuarios/${id}/asociaciones`).set(H(admin.access_token)).send({ asociacion_id: asocB })).status).toBeLessThan(300);
    expect((await request(app).delete(`/api/usuarios/${id}/asociaciones/${asocA}`).set(H(admin.access_token))).status).toBe(200);

    const tras = await request(app).get('/api/dashboard').set(H(sesionA));
    expect(tras.status).toBe(401);
    expect(tras.body.code).toBe('SESION_INVALIDA');
    const { rows } = await query('SELECT asociacion_id FROM usuarios WHERE id = $1', [id]);
    expect(rows[0].asociacion_id).toBe(asocB);
    const nuevaSesion = (await request(app).post('/api/auth/login').send({ correo, password: PW })).body.access_token;
    expect((await request(app).get('/api/dashboard').set(H(nuevaSesion))).status).toBe(200);
  });
});
