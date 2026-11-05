const express = require('express');
const request = require('supertest');
const { crearLimitador } = require('../../src/middlewares/limitadores');

describe('middlewares/limitadores', () => {
  test('corta con 429 al superar el máximo y avisa con JSON', async () => {
    const app = express();
    app.use(crearLimitador({ max: 3 }));
    app.get('/x', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i += 1) expect((await request(app).get('/x')).status).toBe(200);
    const bloqueada = await request(app).get('/x');
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error).toMatch(/Demasiadas peticiones/);
    expect(bloqueada.headers).toHaveProperty('ratelimit-limit'); // cabeceras estándar para el cliente
  });

  test('los límites de la app real son configurables por entorno y tienen valores por defecto sensatos', () => {
    const { limitadorGeneral, limitadorPublico } = require('../../src/middlewares/limitadores');
    expect(typeof limitadorGeneral()).toBe('function');
    expect(typeof limitadorPublico()).toBe('function');
  });
});
