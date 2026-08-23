const request = require('supertest');
const app = require('../../app');

const CORREO_ADMIN = 'admin.test@sigevac.local';
const PASSWORD_ADMIN = 'TestPass#123';

async function loginComoAdmin() {
  const respuesta = await request(app)
    .post('/api/auth/login')
    .send({ correo: CORREO_ADMIN, password: PASSWORD_ADMIN });
  return respuesta.body;
}

module.exports = { app, request, loginComoAdmin, CORREO_ADMIN, PASSWORD_ADMIN };
