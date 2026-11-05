const request = require('supertest');
const { app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');
const { purgarBitacora, purgarCredencialesCaducadas } = require('../../src/utils/retencionBitacora');
const fs = require('fs');
const { descifrarArchivo } = require('../../src/utils/cifradoArchivos');
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
    // El respaldo se guarda CIFRADO: en claro no debe haber SQL ni datos legibles; al descifrarlo, sí.
    expect(archivo).toMatch(/\.sql\.enc$/);
    expect(fs.readFileSync(archivo).toString('latin1')).not.toMatch(/CREATE TABLE|usuarios/);
    const claro = `${archivo}.claro`;
    await descifrarArchivo(archivo, claro);
    const sql = fs.readFileSync(claro, 'utf8');
    fs.unlinkSync(claro);
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

describe('Fase 13 — minimización: sesiones y tokens caducados', () => {
  test('purga sesiones/tokens vencidos o revocados hace más de 30 días y conserva los vigentes y los recientes', async () => {
    const { rows: [{ id: usuarioId }] } = await query('SELECT id FROM usuarios LIMIT 1');
    await query(
      `INSERT INTO sesiones (usuario_id, refresh_token_hash, ip, expira_en, revocado, creado_en) VALUES
        ($1, 'h-vencida-vieja', '1.1.1.1', now() - interval '60 days', false, now() - interval '70 days'),
        ($1, 'h-revocada-vieja', '1.1.1.2', now() + interval '1 day', true, now() - interval '60 days'),
        ($1, 'h-vencida-reciente', '1.1.1.3', now() - interval '2 days', false, now() - interval '9 days'),
        ($1, 'h-vigente', '1.1.1.4', now() + interval '6 days', false, now())`,
      [usuarioId]
    );
    await query(
      `INSERT INTO tokens_recuperacion (usuario_id, token_hash, usado, expira_en, creado_en) VALUES
        ($1, 't-vencido-viejo', false, now() - interval '60 days', now() - interval '60 days'),
        ($1, 't-usado-viejo', true, now() + interval '1 day', now() - interval '60 days'),
        ($1, 't-vigente', false, now() + interval '1 hour', now())`,
      [usuarioId]
    );
    const r = await purgarCredencialesCaducadas(30);
    expect(r.sesiones).toBeGreaterThanOrEqual(2);
    expect(r.tokens_recuperacion).toBeGreaterThanOrEqual(2);
    const sesiones = (await query(`SELECT refresh_token_hash FROM sesiones WHERE refresh_token_hash LIKE 'h-%'`)).rows.map((x) => x.refresh_token_hash);
    expect(sesiones.sort()).toEqual(['h-vencida-reciente', 'h-vigente']);
    const tokens = (await query(`SELECT token_hash FROM tokens_recuperacion WHERE token_hash LIKE 't-%'`)).rows.map((x) => x.token_hash);
    expect(tokens).toEqual(['t-vigente']);
    await query(`DELETE FROM sesiones WHERE refresh_token_hash LIKE 'h-%'`);
    await query(`DELETE FROM tokens_recuperacion WHERE token_hash LIKE 't-%'`);
  });
});
