jest.mock('../../src/utils/email', () => {
  const real = jest.requireActual('../../src/utils/email');
  return { ...real, enviarCorreo: jest.fn().mockResolvedValue({ enviado: true }) };
});
const { request, app, loginComoAdmin } = require('./helpers');
const { enviarCorreo } = require('../../src/utils/email');

describe('M-13 portal: un correo con varios voluntarios recibe acceso a todos', () => {
  test('el correo incluye un enlace por cada voluntario y no revela si el correo existe', async () => {
    const { access_token: t } = await loginComoAdmin();
    const correo = `tutor${Date.now()}@familia.test`;
    const { query } = require('../../src/config/database');
    // El alta por API puede rechazar un correo repetido; el escenario real (dos hermanos con el
    // correo de la familia) se monta por SQL, que es lo que el portal debe saber resolver.
    const primero = await request(app).post('/api/voluntarios').set('Authorization', `Bearer ${t}`)
      .send({ nombre: `Hermano A ${Date.now()}`, fechaNacimiento: '1990-01-01', correo });
    expect(primero.status).toBe(201);
    await query(`INSERT INTO voluntarios (asociacion_id, numero_voluntario, nombre, fecha_nacimiento, correo, es_menor_edad)
                 SELECT asociacion_id, 'SC-X-' || floor(random()*1e9)::text, 'Hermano B', fecha_nacimiento, correo, false
                 FROM voluntarios WHERE correo = $1 LIMIT 1`, [correo]);

    const r = await request(app).post('/api/portal/solicitar-acceso').send({ correo });
    expect(r.status).toBe(200);
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    const html = enviarCorreo.mock.calls[0][0].html;
    expect((html.match(/href="[^"]*\/portal\?token=/g) || []).length).toBe(2); // un enlace por voluntario

    enviarCorreo.mockClear();
    const inexistente = await request(app).post('/api/portal/solicitar-acceso').send({ correo: 'nadie@nada.test' });
    expect(inexistente.status).toBe(200);
    expect(inexistente.body).toEqual(r.body); // misma respuesta exista o no el correo
    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});
