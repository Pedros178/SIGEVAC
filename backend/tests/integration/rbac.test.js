const { app, request, loginComoAdmin } = require('./helpers');

describe('Control de acceso basado en roles (RBAC)', () => {
  let tokenAdmin;
  let tokenCoordinador;
  const correoCoordinador = `coordinador.rbac.${Date.now()}@sigevac.local`;

  beforeAll(async () => {
    const admin = await loginComoAdmin();
    tokenAdmin = admin.access_token;

    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Coordinador RBAC', correo: correoCoordinador, password: 'Coord#12345', rol: 'coordinador' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ correo: correoCoordinador, password: 'Coord#12345' });
    tokenCoordinador = login.body.access_token;
  });

  test('un coordinador NO puede generar respaldos (403)', async () => {
    const respuesta = await request(app)
      .post('/api/respaldos')
      .set('Authorization', `Bearer ${tokenCoordinador}`)
      .send({});
    expect(respuesta.status).toBe(403);
  });

  test('un coordinador NO puede consultar auditoría (403)', async () => {
    const respuesta = await request(app)
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenCoordinador}`);
    expect(respuesta.status).toBe(403);
  });

  test('un coordinador SÍ puede listar voluntarios (tiene el permiso)', async () => {
    const respuesta = await request(app)
      .get('/api/voluntarios')
      .set('Authorization', `Bearer ${tokenCoordinador}`);
    expect(respuesta.status).toBe(200);
  });

  test('un coordinador NO puede crear usuarios del sistema (403)', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenCoordinador}`)
      .send({ nombre: 'Intento', correo: 'intento@sigevac.local', password: 'Algo#1234', rol: 'consulta' });
    expect(respuesta.status).toBe(403);
  });

  test('el super_admin SÍ puede generar respaldos', async () => {
    const respuesta = await request(app)
      .post('/api/respaldos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.respaldo).toHaveProperty('id');
  }, 20000);
});
