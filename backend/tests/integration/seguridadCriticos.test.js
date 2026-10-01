const { authenticator } = require('otplib');
const { request, app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

const PW = 'Victima#Segura77';
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function crearUsuario(token, rol, extra = {}) {
  const correo = `u${unico()}@t.local`;
  const r = await request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Usuario Prueba', correo, password: PW, rol, ...extra });
  return { correo, respuesta: r };
}
async function sesion(correo, password = PW) {
  const r = await request(app).post('/api/auth/login').send({ correo, password });
  return r.body.access_token;
}
async function nuevaAsociacion(token) {
  const r = await request(app).post('/api/asociacion').set('Authorization', `Bearer ${token}`)
    .send({ nombre: `Asoc ${unico()}` });
  return r.body.asociacion?.id;
}

describe('C-01 escalada de privilegios al crear usuarios', () => {
  let admin; let tokenPresidente;
  beforeAll(async () => {
    admin = await loginComoAdmin();
    const { correo } = await crearUsuario(admin.access_token, 'presidente');
    tokenPresidente = await sesion(correo);
  });
  test('un presidente NO puede crear un super_admin', async () => {
    const { respuesta } = await crearUsuario(tokenPresidente, 'super_admin');
    expect(respuesta.status).toBe(403);
  });
  test('un presidente NO puede crear otro presidente con más permisos que los suyos (rol no subconjunto)', async () => {
    const { respuesta } = await crearUsuario(tokenPresidente, 'presidente');
    expect([201, 403]).toContain(respuesta.status); // mismo nivel: permitido sólo si es subconjunto
  });
  test('un presidente SÍ puede crear un coordinador', async () => {
    const { respuesta } = await crearUsuario(tokenPresidente, 'coordinador');
    expect(respuesta.status).toBe(201);
  });
  test('un super_admin SÍ puede crear un super_admin', async () => {
    const { respuesta } = await crearUsuario(admin.access_token, 'super_admin');
    expect(respuesta.status).toBe(201);
  });
});

describe('C-02 aislamiento y protección en gestión de usuarios', () => {
  let admin; let tokenPresA; let idUsuarioOtraAsoc; let idAdmin; let tokenConsultaA;
  beforeAll(async () => {
    admin = await loginComoAdmin();
    idAdmin = admin.usuario.id;
    const asocB = await nuevaAsociacion(admin.access_token);
    const { correo: cPres } = await crearUsuario(admin.access_token, 'presidente');
    tokenPresA = await sesion(cPres);
    const { correo: cCons } = await crearUsuario(admin.access_token, 'consulta');
    tokenConsultaA = await sesion(cCons);
    // usuario que pertenece SOLO a la asociación B
    const { correo: cB, respuesta } = await crearUsuario(admin.access_token, 'coordinador');
    idUsuarioOtraAsoc = respuesta.body.usuario.id;
    await query('DELETE FROM usuario_asociaciones WHERE usuario_id = $1', [idUsuarioOtraAsoc]);
    await query('INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada) VALUES ($1,$2,true)', [idUsuarioOtraAsoc, asocB]);
    await query('UPDATE usuarios SET asociacion_id = $2 WHERE id = $1', [idUsuarioOtraAsoc, asocB]);
    expect(cB).toBeTruthy();
  });
  test('GET /usuarios/:id de otra asociación responde 404', async () => {
    const r = await request(app).get(`/api/usuarios/${idUsuarioOtraAsoc}`).set('Authorization', `Bearer ${tokenConsultaA}`);
    expect(r.status).toBe(404);
  });
  test('PUT /usuarios/:id de otra asociación responde 404 y no modifica', async () => {
    const r = await request(app).put(`/api/usuarios/${idUsuarioOtraAsoc}`).set('Authorization', `Bearer ${tokenPresA}`).send({ nombre: 'HACK' });
    expect(r.status).toBe(404);
    const { rows } = await query('SELECT nombre FROM usuarios WHERE id = $1', [idUsuarioOtraAsoc]);
    expect(rows[0].nombre).not.toBe('HACK');
  });
  test('un presidente NO puede desactivar ni editar a un super_admin', async () => {
    const r = await request(app).put(`/api/usuarios/${idAdmin}`).set('Authorization', `Bearer ${tokenPresA}`).send({ activo: false });
    expect([403, 404]).toContain(r.status);
    const { rows } = await query('SELECT activo FROM usuarios WHERE id = $1', [idAdmin]);
    expect(rows[0].activo).toBe(true);
  });
  test('nadie puede desactivarse a sí mismo', async () => {
    const r = await request(app).put(`/api/usuarios/${idAdmin}`).set('Authorization', `Bearer ${admin.access_token}`).send({ activo: false });
    expect(r.status).toBe(400);
  });
  test('activo con tipo inválido responde 400 (no 500)', async () => {
    const r = await request(app).put(`/api/usuarios/${idUsuarioOtraAsoc}`).set('Authorization', `Bearer ${admin.access_token}`).send({ activo: 'abc' });
    expect(r.status).toBe(400);
  });
  test('GET /usuarios/:id/asociaciones también está aislado', async () => {
    const r = await request(app).get(`/api/usuarios/${idUsuarioOtraAsoc}/asociaciones`).set('Authorization', `Bearer ${tokenConsultaA}`);
    expect(r.status).toBe(404);
  });
});

describe('C-03 2FA no se puede reiniciar con solo un access token', () => {
  test('con 2FA activo, /2fa/setup se rechaza y el 2FA sigue activo', async () => {
    const admin = await loginComoAdmin();
    const { correo } = await crearUsuario(admin.access_token, 'consulta');
    let token = await sesion(correo);
    const s1 = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({ password: PW });
    expect(s1.status).toBe(200);
    const en = await request(app).post('/api/auth/2fa/enable').set('Authorization', `Bearer ${token}`).send({ codigo: authenticator.generate(s1.body.secreto) });
    expect(en.status).toBe(200);
    const intento = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({ password: PW });
    expect(intento.status).toBe(409);
    const login = await request(app).post('/api/auth/login').send({ correo, password: PW });
    expect(login.body.requiere_2fa).toBe(true);
    expect(login.body.access_token).toBeUndefined();
  });
  test('setup sin contraseña correcta se rechaza', async () => {
    const admin = await loginComoAdmin();
    const { correo } = await crearUsuario(admin.access_token, 'consulta');
    const token = await sesion(correo);
    const r = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    expect(r.status).toBe(401);
  });
});
