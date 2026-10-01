const request = require('supertest');
const { app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');
const { purgarBitacora } = require('../../src/utils/retencionBitacora');
const fs = require('fs');
const path = require('path');

describe('A-08 imágenes públicas accesibles desde otro origen', () => {
  test('la ruta pública de imagen envía Cross-Origin-Resource-Policy: cross-origin', async () => {
    const r = await request(app).get('/api/publico/galeria/00000000-0000-0000-0000-000000000000/imagen');
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
  test('el resto de la API conserva same-origin', async () => {
    const r = await request(app).get('/api/health');
    expect(r.headers['cross-origin-resource-policy']).toBe('same-origin');
  });
});

describe('Swagger no se publica en producción por defecto', () => {
  test('en test (no producción) /api/docs responde', async () => {
    expect((await request(app).get('/api/docs/')).status).toBe(200);
  });
});

describe('A-07 respaldos con pg_dump real', () => {
  test('genera un respaldo SQL válido con pg_dump real y permite descargarlo', async () => {
    const { access_token: t } = await loginComoAdmin();
    process.env.RESPALDOS_MAXIMO = '10';
    const r = await request(app).post('/api/respaldos').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(201);
    const archivo = path.join(__dirname, '..', '..', 'backups', path.basename(r.body.respaldo.archivo_url));
    const sql = fs.readFileSync(archivo, 'utf8');
    expect(sql).toMatch(/CREATE TABLE (public\.)?usuarios/);
    const d = await request(app).get(`/api/respaldos/${r.body.respaldo.id}/descargar`).set('Authorization', `Bearer ${t}`);
    expect(d.status).toBe(200);
    fs.unlinkSync(archivo);
    await query('DELETE FROM respaldos WHERE id = $1', [r.body.respaldo.id]);
  });
});

describe('M-08 retención de bitácora', () => {
  test('purga lo antiguo y conserva lo reciente', async () => {
    await query("INSERT INTO bitacora (evento, creado_en) VALUES ('VIEJO-TEST', now() - interval '400 days'), ('NUEVO-TEST', now())");
    const r = await purgarBitacora(365);
    expect(r.bitacora).toBeGreaterThanOrEqual(1);
    const { rows } = await query("SELECT evento FROM bitacora WHERE evento IN ('VIEJO-TEST','NUEVO-TEST')");
    expect(rows.map((x) => x.evento)).toEqual(['NUEVO-TEST']);
  });
});
