#!/usr/bin/env node
/**
 * Prueba de humo para un despliegue REAL (staging o producción). No crea ni modifica datos.
 *
 * Uso:
 *   API_URL=https://tu-api.onrender.com FRONT_URL=https://tu-frontend.example.org \
 *   node scripts/smoke-test.js
 *
 * Opcional (para comprobar la cookie de sesión y un login real):
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=...   (una cuenta existente; solo se hace login y /auth/me)
 *
 * Termina con código 0 si todo pasa, 1 si algo falla. Las advertencias no hacen fallar la ejecución.
 */
const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '').replace(/\/api$/, '');
const FRONT = (process.env.FRONT_URL || '').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_EMAIL; const PASSWORD = process.env.SMOKE_PASSWORD;
const esHttps = API.startsWith('https://');
const resultados = [];

function registrar(estado, nombre, detalle = '') {
  resultados.push({ estado, nombre });
  const icono = { ok: '✅', fallo: '❌', aviso: '⚠️ ', omitido: '➖' }[estado];
  console.log(`${icono} ${nombre}${detalle ? `\n      ${detalle}` : ''}`);
}
async function comprobar(nombre, fn) {
  try { const r = await fn(); if (r === 'omitido') return; if (r && r.aviso) registrar('aviso', nombre, r.aviso); else registrar('ok', nombre); }
  catch (e) { registrar('fallo', nombre, e.message); }
}
const pedir = (ruta, op = {}) => fetch(API + ruta, { redirect: 'manual', ...op });
const exigir = (cond, msg) => { if (!cond) throw new Error(msg); };

(async () => {
  console.log(`\nPrueba de humo → API ${API}${FRONT ? ` · Frontend ${FRONT}` : ''}\n`);

  await comprobar('La API responde y la base de datos está conectada', async () => {
    const r = await pedir('/api/health'); exigir(r.status === 200, `HTTP ${r.status}`);
    const j = await r.json(); exigir(j.base_de_datos === 'ok', `base_de_datos = ${j.base_de_datos}`);
  });

  await comprobar('La API se sirve por HTTPS', async () => {
    if (!esHttps) return { aviso: 'La API usa HTTP. En producción debe ser HTTPS (la cookie de sesión exige Secure).' };
  });

  await comprobar('Cabeceras de seguridad presentes y sin X-Powered-By', async () => {
    const r = await pedir('/api/health'); const h = r.headers;
    exigir(!h.get('x-powered-by'), 'Expone X-Powered-By (revela Express)');
    exigir(h.get('x-content-type-options') === 'nosniff', 'Falta X-Content-Type-Options: nosniff');
    exigir(h.get('x-frame-options') || (h.get('content-security-policy') || '').includes('frame-ancestors'), 'Falta protección contra clickjacking');
    if (esHttps) exigir(h.get('strict-transport-security'), 'Falta Strict-Transport-Security (HSTS)');
  });

  await comprobar('Swagger (/api/docs) no está expuesto', async () => {
    const r = await pedir('/api/docs/');
    if (r.status === 200) return { aviso: 'La documentación de la API es pública (ENABLE_API_DOCS=true o NODE_ENV≠production).' };
  });

  await comprobar('No se sirven archivos sensibles (.env, uploads, backups, package.json, .git)', async () => {
    for (const ruta of ['/.env', '/backend/.env', '/uploads/', '/backups/', '/package.json', '/.git/config', '/api/.env']) {
      const r = await pedir(ruta); exigir(![200, 206].includes(r.status), `${ruta} responde ${r.status}`);
    }
  });

  await comprobar('Los endpoints protegidos exigen sesión (401)', async () => {
    for (const ruta of ['/api/usuarios', '/api/voluntarios', '/api/respaldos', '/api/auditoria', '/api/dashboard']) {
      const r = await pedir(ruta); exigir(r.status === 401, `${ruta} responde ${r.status} sin sesión (debería ser 401)`);
    }
  });

  await comprobar('Un token falso se rechaza', async () => {
    const r = await pedir('/api/usuarios', { headers: { Authorization: 'Bearer abc.def.ghi' } }); exigir(r.status === 401, `HTTP ${r.status}`);
  });

  await comprobar('Login con credenciales falsas: 401 genérico, sin revelar si el correo existe', async () => {
    const a = await pedir('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'no-existe-smoke@example.invalid', password: 'x'.repeat(12) }) });
    exigir(a.status === 401, `HTTP ${a.status}`);
    const t = await a.text(); exigir(!/stack|at \w+\.|node_modules|SELECT |pg_/i.test(t), 'La respuesta de error filtra detalles internos');
  });

  await comprobar('Un error de servidor no filtra detalles internos', async () => {
    const r = await pedir('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"correo":' });
    const t = await r.text(); exigir(r.status === 400, `HTTP ${r.status}`); exigir(!/Unexpected|at JSON|node_modules/i.test(t), 'Filtra el mensaje interno del parser');
  });

  await comprobar('CORS: un origen desconocido NO queda autorizado', async () => {
    const r = await pedir('/api/health', { headers: { Origin: 'https://sitio-malicioso.example' } });
    const acao = r.headers.get('access-control-allow-origin'); exigir(!acao || acao === 'null' ? true : acao !== 'https://sitio-malicioso.example' && acao !== '*', `Access-Control-Allow-Origin: ${acao}`);
  });

  await comprobar('CORS: el frontend configurado SÍ está autorizado (con credenciales)', async () => {
    if (!FRONT) return 'omitido';
    const r = await pedir('/api/auth/login', { method: 'OPTIONS', headers: { Origin: FRONT, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    exigir(r.headers.get('access-control-allow-origin') === FRONT, `Allow-Origin = ${r.headers.get('access-control-allow-origin')}. Revisa FRONTEND_URL en el backend.`);
    exigir(r.headers.get('access-control-allow-credentials') === 'true', 'Falta Access-Control-Allow-Credentials: true (la sesión por cookie no funcionaría)');
  });

  await comprobar('Imágenes públicas legibles desde otro origen (Cross-Origin-Resource-Policy)', async () => {
    const r = await pedir('/api/publico/galeria/00000000-0000-0000-0000-000000000000/imagen');
    exigir(r.headers.get('cross-origin-resource-policy') === 'cross-origin', `CORP = ${r.headers.get('cross-origin-resource-policy')}`);
  });

  await comprobar('Cookie de sesión: HttpOnly, Secure y SameSite correctos (login real)', async () => {
    if (!EMAIL || !PASSWORD) { registrar('omitido', 'Cookie de sesión (define SMOKE_EMAIL y SMOKE_PASSWORD para comprobarla)'); return 'omitido'; }
    const r = await pedir('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: EMAIL, password: PASSWORD }) });
    exigir(r.status === 200, `El login respondió ${r.status}; revisa SMOKE_EMAIL/SMOKE_PASSWORD`);
    const j = await r.json();
    if (j.requiere_2fa) return { aviso: 'La cuenta usa 2FA: no se pudo completar el login automático. Usa una cuenta sin 2FA para esta prueba.' };
    const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || '']).join('; ');
    exigir(/httponly/i.test(cookie), 'La cookie de refresh NO es HttpOnly');
    if (esHttps) { exigir(/secure/i.test(cookie), 'La cookie de refresh NO es Secure'); }
    const m = /samesite=(\w+)/i.exec(cookie);
    if (FRONT && new URL(FRONT).hostname !== new URL(API).hostname) exigir(m && m[1].toLowerCase() === 'none', `Frontend y API están en dominios distintos: SameSite debe ser None (es ${m ? m[1] : 'no definido'})`);
    const me = await pedir('/api/auth/me', { headers: { Authorization: `Bearer ${j.access_token}` } }); exigir(me.status === 200, `/auth/me respondió ${me.status}`);
  });

  if (FRONT) {
    await comprobar('El frontend carga (HTML 200)', async () => {
      const r = await fetch(FRONT + '/', { redirect: 'follow' }); exigir(r.status === 200, `HTTP ${r.status}`);
      exigir((r.headers.get('content-type') || '').includes('text/html'), 'No devuelve HTML');
    });
    await comprobar('El frontend resuelve rutas internas al recargar (/login, /dashboard)', async () => {
      for (const ruta of ['/login', '/dashboard', '/voluntarios']) {
        const r = await fetch(FRONT + ruta, { redirect: 'follow' });
        exigir(r.status === 200, `GET ${ruta} → ${r.status}. Falta la regla de reescritura a index.html (SPA fallback).`);
      }
    });
    await comprobar('El frontend se sirve por HTTPS', async () => { if (!FRONT.startsWith('https://')) return { aviso: 'El frontend usa HTTP.' }; });
    await comprobar('El service worker y el manifest existen (PWA)', async () => {
      for (const ruta of ['/sw.js', '/manifest.webmanifest']) { const r = await fetch(FRONT + ruta); exigir(r.status === 200, `${ruta} → ${r.status}`); }
    });
  }

  const fallos = resultados.filter((r) => r.estado === 'fallo').length;
  const avisos = resultados.filter((r) => r.estado === 'aviso').length;
  const correctas = resultados.filter((r) => r.estado === 'ok').length;
  console.log(`\n${correctas} correctas · ${avisos} avisos · ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
