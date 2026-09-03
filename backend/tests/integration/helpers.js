const request = require('supertest');
const app = require('../../app');

const CORREO_ADMIN = 'admin.test@sigevac.local';
const PASSWORD_ADMIN = 'TestPass#123';

/**
 * Inicia sesión como el admin de pruebas y devuelve tanto los campos del
 * cuerpo de la respuesta (access_token, usuario, ...) como `agent`: un
 * supertest agent que ya trae la cookie httpOnly del refresh token (la
 * fija automáticamente, como haría un navegador real). Los tests que
 * solo necesitan el access_token pueden seguir desestructurando como
 * antes; los que necesitan refrescar/cerrar sesión/cambiar de asociación
 * deben usar `agent` en vez de `request(app)` para que la cookie viaje.
 */
async function loginComoAdmin() {
  const agent = request.agent(app);
  const respuesta = await agent
    .post('/api/auth/login')
    .send({ correo: CORREO_ADMIN, password: PASSWORD_ADMIN });
  return { ...respuesta.body, agent, body: respuesta.body };
}

module.exports = { app, request, loginComoAdmin, CORREO_ADMIN, PASSWORD_ADMIN };
