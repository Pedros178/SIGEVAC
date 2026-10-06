const { authenticator } = require('otplib');
const jwt = require('jsonwebtoken');
const { request, app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

const PW = 'Victima#Segura77';
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let adminToken;
async function crearUsuario(rol = 'consulta') {
  const correo = `a${unico()}@t.local`;
  const r = await request(app).post('/api/usuarios').set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Prueba', correo, password: PW, rol });
  return { correo, id: r.body.usuario.id };
}
const login = (correo, password = PW) => request(app).post('/api/auth/login').send({ correo, password });
const cookieDe = (r) => (r.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');

beforeAll(async () => { adminToken = (await loginComoAdmin()).access_token; });

describe('M-02 login uniforme (sin enumeración de usuarios)', () => {
  test('correo inexistente y contraseña errónea responden idéntico', async () => {
    const { correo } = await crearUsuario();
    const a = await login('noexiste@t.local', 'Incorrecta#1');
    const b = await login(correo, 'Incorrecta#1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
  test('cuenta bloqueada responde igual que credenciales inválidas, aun con la contraseña correcta', async () => {
    const { correo } = await crearUsuario();
    for (let i = 0; i < 3; i++) await login(correo, 'mala');
    const conBuena = await login(correo, PW);
    const inexistente = await login('noexiste2@t.local', 'x');
    expect(conBuena.status).toBe(401);
    expect(conBuena.body).toEqual(inexistente.body);
  });
  test('cuenta desactivada: con contraseña incorrecta NO se revela (401 genérico)', async () => {
    const { correo, id } = await crearUsuario();
    await request(app).put(`/api/usuarios/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ activo: false });
    const mala = await login(correo, 'cualquiera');
    expect(mala.status).toBe(401);
  });
  test('tipos inválidos responden 400 (antes 500)', async () => {
    for (const body of [{ correo: 123, password: 'x' }, { correo: 'a@b.c', password: 123 }, { correo: { $ne: null }, password: 'x' }, { correo: ['a@b.c'], password: 'x' }]) {
      const r = await request(app).post('/api/auth/login').send(body);
      expect(r.status).toBe(400);
    }
  });
  test('una contraseña gigante se rechaza sin ejecutar bcrypt', async () => {
    const t = Date.now();
    const r = await login('admin.test@sigevac.local', 'A'.repeat(500000));
    expect(r.status).toBe(401);
    expect(Date.now() - t).toBeLessThan(400);
  });
  test('el cuerpo del 401 ya no incluye intentos_restantes', async () => {
    const { correo } = await crearUsuario();
    const r = await login(correo, 'mala');
    expect(r.body.intentos_restantes).toBeUndefined();
  });
});

describe('M-06 / M-07 el access token se revalida en cada petición', () => {
  test('un token de portal o de 2FA no sirve como sesión', async () => {
    const portal = jwt.sign({ tipo: 'portal', voluntarioId: '00000000-0000-0000-0000-000000000000' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const dosfa = jwt.sign({ tipo: '2fa', usuarioId: '00000000-0000-0000-0000-000000000000' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    for (const t of [portal, dosfa]) {
      for (const ruta of ['/api/dashboard', '/api/notificaciones', '/api/auth/me']) {
        const r = await request(app).get(ruta).set('Authorization', `Bearer ${t}`);
        expect(r.status).toBe(401);
      }
    }
  });
  test('desactivar al usuario invalida su access token de inmediato', async () => {
    const { correo, id } = await crearUsuario();
    const l = await login(correo);
    expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${l.body.access_token}`)).status).toBe(200);
    await request(app).put(`/api/usuarios/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ activo: false });
    const tras = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${l.body.access_token}`);
    expect(tras.status).toBe(401);
    expect(tras.body.code).toBe('SESION_INVALIDA');
  });
  test('quitar un rol surte efecto sin esperar a que expire el token', async () => {
    const { correo, id } = await crearUsuario('super_admin');
    const l = await login(correo);
    expect((await request(app).get('/api/respaldos').set('Authorization', `Bearer ${l.body.access_token}`)).status).toBe(200);
    await query('DELETE FROM usuarios_roles WHERE usuario_id = $1', [id]);
    expect((await request(app).get('/api/respaldos').set('Authorization', `Bearer ${l.body.access_token}`)).status).toBe(403);
  });
});

describe('M-04 2FA: anti-replay, bloqueo por intentos, secreto cifrado y recuperación', () => {
  async function usuarioCon2FA() {
    const { correo, id } = await crearUsuario();
    const l = await login(correo);
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${l.body.access_token}`).send({ password: PW });
    await request(app).post('/api/auth/2fa/enable').set('Authorization', `Bearer ${l.body.access_token}`).send({ codigo: authenticator.generate(setup.body.secreto) });
    return { correo, id, secreto: setup.body.secreto, token: l.body.access_token };
  }
  test('el mismo código TOTP no se puede usar dos veces', async () => {
    const u = await usuarioCon2FA();
    const codigo = authenticator.generate(u.secreto);
    const d1 = (await login(u.correo)).body.desafio_2fa;
    const d2 = (await login(u.correo)).body.desafio_2fa;
    expect((await request(app).post('/api/auth/login-2fa').send({ desafio_2fa: d1, codigo })).status).toBe(200);
    expect((await request(app).post('/api/auth/login-2fa').send({ desafio_2fa: d2, codigo })).status).toBe(401);
  });
  test('los códigos erróneos bloquean la cuenta (no hay fuerza bruta ilimitada)', async () => {
    const u = await usuarioCon2FA();
    const d = (await login(u.correo)).body.desafio_2fa;
    const estados = [];
    for (let i = 0; i < 5; i++) estados.push((await request(app).post('/api/auth/login-2fa').send({ desafio_2fa: d, codigo: String(111110 + i) })).status);
    expect(estados.every((e) => e === 401)).toBe(true);
    const { rows } = await query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = $1', [u.id]);
    expect(rows[0].bloqueado_hasta).not.toBeNull();
    // con el código CORRECTO y la cuenta bloqueada tampoco entra
    const bueno = await request(app).post('/api/auth/login-2fa').send({ desafio_2fa: d, codigo: authenticator.generate(u.secreto) });
    expect(bueno.status).toBe(401);
  });
  test('el secreto TOTP se guarda cifrado en la base de datos', async () => {
    const u = await usuarioCon2FA();
    const { rows } = await query('SELECT two_factor_secret FROM usuarios WHERE id = $1', [u.id]);
    expect(rows[0].two_factor_secret.startsWith('enc:v1:')).toBe(true);
    expect(rows[0].two_factor_secret).not.toContain(u.secreto);
  });
  test('un super_admin puede reiniciar el 2FA de un usuario que perdió su dispositivo; un presidente no', async () => {
    const u = await usuarioCon2FA();
    const pres = await crearUsuario('presidente');
    const tokPres = (await login(pres.correo)).body.access_token;
    expect((await request(app).post(`/api/usuarios/${u.id}/2fa/reset`).set('Authorization', `Bearer ${tokPres}`)).status).toBe(403);
    expect((await request(app).post(`/api/usuarios/${u.id}/2fa/reset`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await login(u.correo)).body.requiere_2fa).toBeFalsy();
  });
});

describe('M-05 rotación del refresh token', () => {
  test('cada refresh entrega una cookie nueva y la anterior deja de servir tras la gracia', async () => {
    const { correo } = await crearUsuario();
    const l = await login(correo);
    const c1 = cookieDe(l);
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', c1);
    expect(r1.status).toBe(200);
    const c2 = cookieDe(r1);
    expect(c2).toBeTruthy();
    expect(c2).not.toEqual(c1);
    // pasada la ventana de gracia, reutilizar la cookie vieja es señal de robo: 401 y se cierran TODAS las sesiones
    await query("UPDATE sesiones SET rotado_en = now() - interval '1 minute' WHERE rotado_en IS NOT NULL");
    const reuso = await request(app).post('/api/auth/refresh').set('Cookie', c1);
    expect(reuso.status).toBe(401);
    const trasReuso = await request(app).post('/api/auth/refresh').set('Cookie', c2);
    expect(trasReuso.status).toBe(401);
  });
  test('dos refresh simultáneos (pestañas) con la misma cookie no cierran la sesión', async () => {
    const { correo } = await crearUsuario();
    const c = cookieDe(await login(correo));
    const [a, b] = await Promise.all([1, 2].map(() => request(app).post('/api/auth/refresh').set('Cookie', c)));
    expect([a.status, b.status]).toEqual([200, 200]);
  });
});

describe('M-05 restablecimiento de contraseña atómico', () => {
  test('el mismo token usado en paralelo solo funciona una vez', async () => {
    const { correo, id } = await crearUsuario();
    const crypto = require('crypto');
    const plano = crypto.randomBytes(20).toString('hex');
    await query('INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en) VALUES ($1,$2, now() + interval \'1 hour\')',
      [id, crypto.createHash('sha256').update(plano).digest('hex')]);
    const resultados = await Promise.all([1, 2, 3].map((i) => request(app).post('/api/auth/reset-password').send({ token: plano, nueva_password: `NuevaClave#2026x${i}` })));
    expect(resultados.filter((r) => r.status === 200)).toHaveLength(1);
    expect(correo).toBeTruthy();
  });
});

describe('A-03 cambio de contraseña autenticado', () => {
  test('exige la contraseña actual, aplica la política y revoca otras sesiones', async () => {
    const { correo } = await crearUsuario();
    const l1 = await login(correo);
    const otraSesion = cookieDe(await login(correo));
    const H = (t) => ({ Authorization: `Bearer ${t}` });
    expect((await request(app).post('/api/auth/change-password').send({ password_actual: PW, nueva_password: 'Nueva#Clave2026' })).status).toBe(401);
    expect((await request(app).post('/api/auth/change-password').set(H(l1.body.access_token)).send({ password_actual: 'mal', nueva_password: 'Nueva#Clave2026' })).status).toBe(401);
    expect((await request(app).post('/api/auth/change-password').set(H(l1.body.access_token)).send({ password_actual: PW, nueva_password: 'password123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/change-password').set(H(l1.body.access_token)).send({ password_actual: PW, nueva_password: PW })).status).toBe(400);
    const ok = await request(app).post('/api/auth/change-password').set(H(l1.body.access_token)).send({ password_actual: PW, nueva_password: 'Nueva#Clave2026' });
    expect(ok.status).toBe(200);
    expect(ok.body.access_token).toBeTruthy();
    expect((await login(correo, PW)).status).toBe(401);
    expect((await login(correo, 'Nueva#Clave2026')).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', otraSesion)).status).toBe(401);
  });
});

describe('M-08 la auditoría no guarda secretos', () => {
  test('códigos 2FA, contraseñas y tokens quedan ocultos en el detalle', async () => {
    const { correo } = await crearUsuario();
    const l = await login(correo);
    await request(app).post('/api/auth/2fa/enable').set('Authorization', `Bearer ${l.body.access_token}`).send({ codigo: '123456' });
    await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${l.body.access_token}`).send({ password_actual: PW, nueva_password: 'Otra#Clave20266' });
    await new Promise((r) => setTimeout(r, 300));
    const { rows } = await query("SELECT detalle::text AS d FROM auditoria WHERE accion LIKE '%/auth/%' ORDER BY creado_en DESC LIMIT 20");
    const todo = rows.map((x) => x.d).join(' ');
    expect(todo).not.toContain('123456');
    expect(todo).not.toContain('Otra#Clave20266');
    expect(todo).not.toContain(PW);
  });
});

describe('R-7 cambio obligatorio de la contraseña inicial', () => {
  test('con la marca activa solo se puede cambiar la contraseña; después queda libre', async () => {
    const { correo, id } = await crearUsuario('presidente');
    await query('UPDATE usuarios SET debe_cambiar_password = true WHERE id = $1', [id]);
    const l = await login(correo);
    expect(l.status).toBe(200);
    expect(l.body.usuario.debe_cambiar_password).toBe(true);
    const H = { Authorization: `Bearer ${l.body.access_token}` };

    const bloqueado = await request(app).get('/api/dashboard').set(H);
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.code).toBe('PASSWORD_CAMBIO_REQUERIDO');
    expect((await request(app).get('/api/voluntarios').set(H)).status).toBe(403);
    expect((await request(app).post('/api/usuarios').set(H).send({})).status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(H)).status).toBe(200); // permitido

    const cambio = await request(app).post('/api/auth/change-password').set(H).send({ password_actual: PW, nueva_password: 'Propia#Clave2026' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.usuario.debe_cambiar_password).toBe(false);
    const H2 = { Authorization: `Bearer ${cambio.body.access_token}` };
    expect((await request(app).get('/api/dashboard').set(H2)).status).toBe(200);
    const { rows } = await query('SELECT debe_cambiar_password FROM usuarios WHERE id = $1', [id]);
    expect(rows[0].debe_cambiar_password).toBe(false);
  });
});
