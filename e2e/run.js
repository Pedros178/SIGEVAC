/**
 * Pruebas de navegador (extremo a extremo) de SIGEVAC.
 *
 * Abren un Chromium real, recorren la interfaz como lo haría una persona y
 * comprueban lo que se VE. Sirven para validar un despliegue de prueba (staging)
 * antes de pasar a producción.
 *
 * Uso:
 *   cd e2e && npm install
 *   FRONT_URL=https://tu-frontend API_URL=https://tu-api/api \
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm test
 *
 * Variables:
 *   FRONT_URL / API_URL        Dónde corre el frontend y la API (por defecto, desarrollo local)
 *   E2E_ADMIN_EMAIL / _PASSWORD  Un super_admin existente (crea y desactiva usuarios de prueba)
 *   CHROME_PATH                Chrome/Chromium propio (si no, se usa @sparticuz/chromium)
 *   E2E_DATABASE_URL           (Opcional) Conexión a la BD de PRUEBA para la prueba del cambio obligatorio de contraseña (requiere `psql`)
 *   E2E_SOLO                   Ejecuta solo las pruebas cuyo nombre contenga este texto
 *
 * Las pruebas CREAN datos con el prefijo "E2E-" (usuarios, voluntarios, artículos).
 * Úsalas contra un entorno de prueba, no contra producción real.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const FRONT = (process.env.FRONT_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const ADMIN = { correo: process.env.E2E_ADMIN_EMAIL || 'admin@suenosdecomedia.org', password: process.env.E2E_ADMIN_PASSWORD || 'Sigevac#2026' };
const PW_USUARIOS = 'E2e#Clave2026ok';
const SOLO = process.env.E2E_SOLO || '';
const CARPETA_CAPTURAS = path.join(__dirname, 'capturas');
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- API (para preparar datos y consultar estado, no para lo que se prueba en la UI)
async function api(metodo, ruta, { token, body } = {}) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  let json; try { json = JSON.parse(texto); } catch { json = null; }
  return { status: r.status, json };
}
let tokenAdmin;
async function crearUsuario(rol, extra = {}) {
  const correo = `e2e-${rol}-${unico()}@prueba.local`;
  const r = await api('POST', '/usuarios', { token: tokenAdmin, body: { nombre: `E2E ${rol}`, correo, password: PW_USUARIOS, rol, ...extra } });
  if (r.status !== 201) throw new Error(`No se pudo crear el usuario de prueba (${r.status}): ${JSON.stringify(r.json)}`);
  return { correo, id: r.json.usuario.id };
}

// ---------- navegador
async function lanzar() {
  const ejecutable = process.env.CHROME_PATH;
  if (ejecutable) return puppeteer.launch({ executablePath: ejecutable, headless: true, args: ['--no-sandbox'] });
  const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
  // --single-process (pensado para AWS Lambda) no admite contextos aislados ni varias pestañas
  const args = chromium.args.filter((a) => !['--single-process', '--no-zygote'].includes(a));
  return puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: 'shell' });
}
async function nuevaPagina(browser, { ancho = 1280, alto = 900 } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: ancho, height: alto });
  page.setDefaultTimeout(15000);
  page.errores = [];
  page.fallos = [];
  page.on('requestfailed', (r) => page.fallos.push(`${r.method()} ${r.url()} → ${r.failure()?.errorText}`));
  page.on('pageerror', (e) => page.errores.push(`pageerror: ${e.message}`));
  page.on('dialog', async (d) => { page.errores.push(`diálogo inesperado: ${d.message()}`); await d.dismiss().catch(() => {}); });
  page.ctx = ctx;
  return page;
}
const url = (p) => `${FRONT}${p}`;
const ruta = (page) => new URL(page.url()).pathname;
async function textoVisible(page, texto, ms = 15000) {
  await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout: ms }, texto);
}
async function clickTexto(page, texto, selector = 'button, a') {
  await page.waitForFunction((t, sel) => [...document.querySelectorAll(sel)].some((e) => e.innerText && e.innerText.trim().includes(t) && !e.disabled),
    { timeout: 10000 }, texto, selector).catch(() => {});
  const ok = await page.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.innerText && e.innerText.trim().includes(t) && !e.disabled);
    if (el) { el.click(); return true; }
    return false;
  }, texto, selector);
  if (!ok) throw new Error(`No se encontró el botón/enlace con texto "${texto}"`);
}
async function iniciarSesion(page, correo, password) {
  await page.goto(url('/login'), { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]', correo);
  await page.type('input[type=password]', password);
  await page.click('button[type=submit]');
}
async function entrar(page, correo, password) {
  await iniciarSesion(page, correo, password);
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 15000 });
}
async function esperarRuta(page, destino, ms = 15000) {
  await page.waitForFunction((d) => location.pathname === d || location.pathname.startsWith(d), { timeout: ms }, destino);
}

// ---------- ejecutor
const resultados = [];
async function prueba(nombre, fn) {
  if (SOLO && !nombre.includes(SOLO)) return;
  const inicio = Date.now();
  const paginas = [];
  const ctx = { nueva: async (op) => { const p = await nuevaPagina(ctx.browser, op); paginas.push(p); return p; } };
  ctx.browser = prueba.browser;
  try {
    await fn(ctx);
    for (const p of paginas) if (p.errores.length) throw new Error(`Errores en el navegador: ${p.errores.join(' | ')}`);
    resultados.push({ nombre, ok: true, ms: Date.now() - inicio });
    console.log(`  ✅ ${nombre} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  } catch (err) {
    const fallosRed = paginas.flatMap((p) => p.fallos || []);
    if (fallosRed.length) err.message += `\n       peticiones fallidas: ${fallosRed.slice(0, 3).join(' ; ')}`;
    resultados.push({ nombre, ok: false, error: err.message });
    console.log(`  ❌ ${nombre}\n       ${err.message}`);
    fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
    for (const [i, p] of paginas.entries()) {
      try { await p.screenshot({ path: path.join(CARPETA_CAPTURAS, `${nombre.replace(/[^\w]+/g, '_').slice(0, 60)}_${i}.png`) }); } catch { /* página cerrada */ }
    }
  } finally {
    for (const p of paginas) await p.ctx.close().catch(() => {});
  }
}

(async () => {
  console.log(`\nSIGEVAC e2e → frontend ${FRONT} · API ${API}\n`);
  const login = await api('POST', '/auth/login', { body: ADMIN });
  if (login.status !== 200) { console.error(`No se pudo iniciar sesión como administrador (${login.status}). Revisa E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.`); process.exit(2); }
  tokenAdmin = login.json.access_token;
  const browser = await lanzar();
  prueba.browser = browser;

  await prueba('La página pública carga sin errores', async ({ nueva }) => {
    const p = await nueva();
    const resp = await p.goto(url('/'), { waitUntil: 'networkidle2' });
    if (resp.status() !== 200) throw new Error(`HTTP ${resp.status()}`);
    const texto = await p.evaluate(() => document.body.innerText.trim().length);
    if (texto < 50) throw new Error('La página quedó prácticamente en blanco');
  });

  await prueba('Una ruta protegida sin sesión redirige a /login', async ({ nueva }) => {
    const p = await nueva();
    for (const r of ['/dashboard', '/voluntarios', '/inventario', '/administracion']) {
      await p.goto(url(r), { waitUntil: 'networkidle2' });
      await esperarRuta(p, '/login');
    }
  });

  await prueba('Login con contraseña incorrecta muestra error y no entra', async ({ nueva }) => {
    const p = await nueva();
    await iniciarSesion(p, ADMIN.correo, 'ContraseñaEquivocada#1');
    await textoVisible(p, 'Credenciales inválidas');
    if (ruta(p) !== '/login') throw new Error(`Salió de /login: ${ruta(p)}`);
  });

  await prueba('Login correcto, dashboard y la sesión sobrevive a recargar la página', async ({ nueva }) => {
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await esperarRuta(p, '/dashboard');
    await textoVisible(p, 'Bienvenido');
    await p.reload({ waitUntil: 'networkidle2' });
    await textoVisible(p, 'Bienvenido');
    if (ruta(p) !== '/dashboard') throw new Error(`Tras recargar terminó en ${ruta(p)}`);
  });

  await prueba('Cerrar sesión devuelve a /login y bloquea la navegación atrás', async ({ nueva }) => {
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await esperarRuta(p, '/dashboard');
    await clickTexto(p, 'Salir');
    await esperarRuta(p, '/login');
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await esperarRuta(p, '/login');
  });

  await prueba('Voluntarios: registrar desde el formulario, buscarlo por apellido y verlo en la lista', async ({ nueva }) => {
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    const apellido = `Prueba${unico()}`;
    await clickTexto(p, '+ Registrar voluntario');
    await p.waitForSelector('form input.sg-input');
    const entradas = await p.$$('form input.sg-input');
    await entradas[0].type('E2E Nombre');
    await entradas[1].type(apellido);
    const fechas = await p.$$('form input[type=date]');
    await fechas[0].type('15/06/1995');
    await clickTexto(p, 'Registrar voluntario', 'button[type=submit]');
    await p.waitForFunction(() => !document.querySelector('form input[type=date]'), { timeout: 15000 });
    await p.type('input[placeholder^="Buscar por nombre"]', apellido);
    await p.keyboard.press('Enter');
    await textoVisible(p, apellido);
  });

  await prueba('Voluntarios: una búsqueda sin resultados muestra la lista vacía, sin romper la pantalla', async ({ nueva }) => {
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await p.type('input[placeholder^="Buscar por nombre"]', 'zzz-no-existe-9999');
    await p.keyboard.press('Enter');
    await dormir(1200);
    const hayH1 = await p.$('h1');
    if (!hayH1) throw new Error('La pantalla se rompió tras una búsqueda vacía');
  });

  await prueba('XSS: un artículo con HTML malicioso NO ejecuta código al imprimir la etiqueta QR', async ({ nueva }) => {
    const nombre = `E2E-XSS-${unico()}`;
    const maliciosos = [`${nombre}<img src=x onerror="window.opener.__pwned=1">`, `${nombre}</title><script>window.opener.__pwned=2</script>`];
    for (const n of maliciosos) {
      const r = await api('POST', '/inventario', { token: tokenAdmin, body: { nombre: n, unidad: 'pza' } });
      if (r.status !== 201) throw new Error(`No se pudo crear el artículo de prueba: ${r.status}`);
    }
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await p.goto(url('/inventario'), { waitUntil: 'networkidle2' });
    await p.type('input[placeholder^="Buscar artículo"]', nombre);
    await dormir(1000);
    const tarjetas = await p.$$('button[style]');
    let abiertas = 0;
    for (const sufijo of ['<img', '</title>']) {
      await p.evaluate((nom, suf) => {
        const el = [...document.querySelectorAll('button')].find((b) => b.innerText.includes(nom) && b.innerText.includes(suf));
        if (el) el.click();
      }, nombre, sufijo);
      await dormir(800);
      const hayImprimir = await p.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Imprimir QR')));
      if (!hayImprimir) continue;
      const nuevoDestino = new Promise((res) => p.browser().once('targetcreated', res));
      await clickTexto(p, 'Imprimir QR');
      await Promise.race([nuevoDestino, dormir(5000)]);
      await dormir(1500);
      abiertas++;
      await clickTexto(p, 'Cerrar').catch(() => {});
      await dormir(400);
    }
    void tarjetas;
    if (abiertas === 0) throw new Error('No se pudo abrir la etiqueta QR de ningún artículo (la prueba no comprobó nada)');
    const pwned = await p.evaluate(() => window.__pwned);
    if (pwned) throw new Error(`¡Se ejecutó código inyectado! window.__pwned=${pwned}`);
  });

  await prueba('Cambio de contraseña desde Administración, y el nuevo login funciona', async ({ nueva }) => {
    const u = await crearUsuario('presidente');
    const p = await nueva();
    await entrar(p, u.correo, PW_USUARIOS);
    await p.goto(url('/administracion'), { waitUntil: 'networkidle2' });
    await textoVisible(p, 'Cambiar contraseña');
    const nueva2 = 'Nueva#Clave2026ok';
    await p.type('input[aria-label="Contraseña actual para cambiarla"]', PW_USUARIOS);
    await p.type('input[aria-label="Nueva contraseña"]', nueva2);
    await p.type('input[aria-label="Confirmar nueva contraseña"]', nueva2);
    await clickTexto(p, 'Cambiar contraseña', 'button[type=submit]');
    await textoVisible(p, 'Contraseña actualizada');
    const p2 = await nueva();
    await entrar(p2, u.correo, nueva2);
    const vieja = await nueva();
    await iniciarSesion(vieja, u.correo, PW_USUARIOS);
    await textoVisible(vieja, 'Credenciales inválidas');
  });

  await prueba('Si un administrador desactiva al usuario, su sesión abierta se cierra en la siguiente acción', async ({ nueva }) => {
    const u = await crearUsuario('coordinador');
    const p = await nueva();
    await entrar(p, u.correo, PW_USUARIOS);
    await esperarRuta(p, '/dashboard');
    const r = await api('PUT', `/usuarios/${u.id}`, { token: tokenAdmin, body: { activo: false } });
    if (r.status !== 200) throw new Error(`No se pudo desactivar: ${r.status}`);
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await esperarRuta(p, '/login');
  });

  await prueba('Dos pestañas comparten la sesión; cerrar sesión en una la cierra en la otra al recargar', async ({ nueva }) => {
    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await esperarRuta(p, '/dashboard');
    const p2 = await p.ctx.newPage();
    p2.setDefaultTimeout(15000);
    await p2.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await textoVisible(p2, 'Voluntarios');
    if (ruta(p2) !== '/voluntarios') throw new Error(`La 2ª pestaña terminó en ${ruta(p2)}`);
    await clickTexto(p, 'Salir');
    await esperarRuta(p, '/login');
    await p2.reload({ waitUntil: 'networkidle2' });
    await esperarRuta(p2, '/login');
  });

  await prueba('Rol "consulta": no puede registrar voluntarios ni entrar a Administración', async ({ nueva }) => {
    const u = await crearUsuario('consulta');
    const p = await nueva();
    await entrar(p, u.correo, PW_USUARIOS);
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await textoVisible(p, 'Voluntarios');
    const puedeRegistrar = await p.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('+ Registrar voluntario')));
    if (puedeRegistrar) throw new Error('El rol consulta ve el botón de registrar voluntario');
    await p.goto(url('/administracion'), { waitUntil: 'networkidle2' });
    const texto = await p.evaluate(() => document.body.innerText);
    if (/Crear usuario|Nuevo usuario/i.test(texto)) throw new Error('El rol consulta ve controles de administración de usuarios');
  });

  await prueba('Aislamiento: un usuario de otra asociación no ve los voluntarios de la primera', async ({ nueva }) => {
    const asoc = await api('POST', '/asociacion', { token: tokenAdmin, body: { nombre: `E2E Asociación ${unico()}` } });
    if (asoc.status !== 201) throw new Error(`No se pudo crear la asociación: ${asoc.status}`);
    const marca = `AislaE2E${unico()}`;
    const alta = await api('POST', '/voluntarios', { token: tokenAdmin, body: { nombre: 'Aislado', apellidoPaterno: marca, fechaNacimiento: '1990-01-01' } });
    if (alta.status !== 201) throw new Error(`No se pudo crear el voluntario: ${alta.status}`);
    const u = await crearUsuario('coordinador');
    // Se mueve al usuario a la asociación nueva: primero se agrega la nueva y luego se retira la original
    // (la API no permite dejar a un usuario sin ninguna asociación).
    const originales = (await api('GET', `/usuarios/${u.id}/asociaciones`, { token: tokenAdmin })).json.asociaciones;
    const add = await api('POST', `/usuarios/${u.id}/asociaciones`, { token: tokenAdmin, body: { asociacion_id: asoc.json.asociacion.id } });
    if (![200, 201].includes(add.status)) throw new Error(`No se pudo reasignar al usuario: ${add.status}`);
    for (const o of originales) {
      const quitar = await api('DELETE', `/usuarios/${u.id}/asociaciones/${o.id}`, { token: tokenAdmin });
      if (quitar.status !== 200) throw new Error(`No se pudo retirar la asociación original: ${quitar.status}`);
    }
    const p = await nueva();
    await entrar(p, u.correo, PW_USUARIOS);
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });
    await p.type('input[placeholder^="Buscar por nombre"]', marca);
    await p.keyboard.press('Enter');
    await dormir(1500);
    const texto = await p.evaluate(() => document.body.innerText);
    if (texto.includes(marca)) throw new Error('Se ve un voluntario de OTRA asociación');
  });

  await prueba('Contraseña inicial: la cuenta marcada debe cambiarla antes de usar el sistema', async ({ nueva }) => {
    if (!process.env.E2E_DATABASE_URL) { console.log('       (omitida: define E2E_DATABASE_URL para ejecutarla)'); return; }
    const u = await crearUsuario('presidente');
    require('child_process').execFileSync('psql', [process.env.E2E_DATABASE_URL, '-c', `UPDATE usuarios SET debe_cambiar_password = true WHERE id = '${u.id}'`]);
    const p = await nueva();
    await entrar(p, u.correo, PW_USUARIOS);
    await esperarRuta(p, '/cambiar-password');
    await textoVisible(p, 'Cambia tu contraseña inicial');
    await p.goto(url('/voluntarios'), { waitUntil: 'networkidle2' });   // intentar saltarse el cambio
    await esperarRuta(p, '/cambiar-password');
    const nueva2 = 'Propia#Clave2026ok';
    await p.type('input[aria-label="Contraseña actual para cambiarla"]', PW_USUARIOS);
    await p.type('input[aria-label="Nueva contraseña"]', nueva2);
    await p.type('input[aria-label="Confirmar nueva contraseña"]', nueva2);
    await clickTexto(p, 'Cambiar contraseña', 'button[type=submit]');
    await esperarRuta(p, '/dashboard');
    await textoVisible(p, 'Bienvenido');
  });

  await prueba('Todas las pantallas del sistema cargan sin errores de JavaScript ni respuestas 5xx de la API', async ({ nueva }) => {
    const vols = (await api('GET', '/voluntarios?limit=1', { token: tokenAdmin })).json.voluntarios || [];
    const acts = (await api('GET', '/actividades', { token: tokenAdmin })).json.actividades || [];
    const rutas = ['/', '/login', '/solicitud', '/dashboard', '/voluntarios', '/actividades', '/reportes', '/inventario', '/administracion'];
    if (vols[0]) rutas.push(`/voluntarios/${vols[0].id}`);
    if (acts[0]) rutas.push(`/actividades/${acts[0].id}`);
    const p = await nueva();
    const respuestasMalas = [];
    p.on('response', (r) => {
      if (!r.url().startsWith(API)) return;
      const esperado401 = r.status() === 401 && r.url().endsWith('/auth/refresh'); // sin sesión, es lo normal
      if ((r.status() >= 500 || (r.status() >= 400 && !esperado401 && r.status() !== 404)) ) respuestasMalas.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`);
    });
    await entrar(p, ADMIN.correo, ADMIN.password);
    await esperarRuta(p, '/dashboard');
    for (const r of rutas) {
      await p.goto(url(r), { waitUntil: 'networkidle2' });
      await dormir(500);
      const info = await p.evaluate(() => ({ largo: document.body.innerText.trim().length, error: /something went wrong|algo salió mal|Cannot read|undefined is not/i.test(document.body.innerText) }));
      if (info.largo < 40) throw new Error(`${r}: la pantalla quedó prácticamente en blanco`);
      if (info.error) throw new Error(`${r}: muestra un mensaje de error de la aplicación`);
      if (r.startsWith('/dashboard') === false && ruta(p) === '/login' && !['/', '/login', '/solicitud'].includes(r)) throw new Error(`${r}: te sacó a /login con la sesión activa`);
    }
    if (respuestasMalas.length) throw new Error(`Respuestas inesperadas de la API: ${[...new Set(respuestasMalas)].slice(0, 5).join(' ; ')}`);
  });

  await prueba('Sin conexión: la asistencia se registra en el dispositivo y se sincroniza al volver la red', async ({ nueva }) => {
    // Preparación por API: una actividad con un voluntario inscrito
    const act = await api('POST', '/actividades', { token: tokenAdmin, body: { nombre: `E2E-Offline ${unico()}`, fecha: new Date().toLocaleDateString('en-CA') } });
    if (act.status !== 201) throw new Error(`No se pudo crear la actividad: ${act.status}`);
    const vol = await api('POST', '/voluntarios', { token: tokenAdmin, body: { nombre: 'E2E Offline', apellidoPaterno: `Asist${unico()}`, fechaNacimiento: '1990-01-01' } });
    const insc = await api('POST', `/actividades/${act.json.actividad.id}/participaciones`, { token: tokenAdmin, body: { voluntarioId: vol.json.voluntario.id } });
    if (insc.status !== 201) throw new Error(`No se pudo inscribir: ${insc.status}`);
    const participacionId = insc.json.participacion.id;

    const p = await nueva();
    await entrar(p, ADMIN.correo, ADMIN.password);
    await p.goto(url(`/actividades/${act.json.actividad.id}`), { waitUntil: 'networkidle2' });
    await textoVisible(p, 'Registrar entrada');

    await p.setOfflineMode(true);
    await p.evaluate(() => window.dispatchEvent(new Event('offline')));
    await textoVisible(p, 'Sin conexión');
    await clickTexto(p, 'Registrar entrada');
    await textoVisible(p, '1 pendiente');

    // Mientras no hay red, el servidor NO debe tener la entrada
    const antes = await api('GET', `/actividades/${act.json.actividad.id}/participaciones`, { token: tokenAdmin });
    const filaAntes = (antes.json.participantes || []).find((x) => x.participacion_id === participacionId || x.id === participacionId);
    if (filaAntes && filaAntes.hora_entrada) throw new Error('La entrada llegó al servidor estando sin conexión (no debería)');

    await p.setOfflineMode(false);
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await p.waitForFunction(() => !document.body.innerText.includes('pendiente'), { timeout: 20000 });

    const despues = await api('GET', `/actividades/${act.json.actividad.id}/participaciones`, { token: tokenAdmin });
    const fila = (despues.json.participantes || []).find((x) => x.participacion_id === participacionId || x.id === participacionId);
    if (!fila || !fila.hora_entrada) throw new Error('Tras recuperar la conexión la entrada NO quedó registrada en el servidor');
  });

  await prueba('Móvil (375 px): el login no genera desplazamiento horizontal y se puede iniciar sesión', async ({ nueva }) => {
    const p = await nueva({ ancho: 375, alto: 700 });
    await p.goto(url('/login'), { waitUntil: 'networkidle2' });
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (desborda) throw new Error('Hay desplazamiento horizontal en el login móvil');
    await entrar(p, ADMIN.correo, ADMIN.password);
    await esperarRuta(p, '/dashboard');
    const desborda2 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (desborda2) throw new Error('Hay desplazamiento horizontal en el dashboard móvil');
  });

  await prueba('Con el backend caído la interfaz muestra un mensaje en vez de quedarse en blanco', async ({ nueva }) => {
    const p = await nueva();
    await p.goto(url('/login'), { waitUntil: 'networkidle2' });
    await p.setRequestInterception(true);
    p.on('request', (req) => (req.url().startsWith(API) ? req.abort('connectionrefused') : req.continue()));
    await p.waitForSelector('input[type=email]');
    await p.type('input[type=email]', ADMIN.correo);
    await p.type('input[type=password]', ADMIN.password);
    await p.click('button[type=submit]');
    await p.waitForFunction(() => /no se pudo|network|error|conexi/i.test(document.body.innerText), { timeout: 15000 });
    if (ruta(p) !== '/login') throw new Error('Debería seguir en /login');
    const visible = await p.evaluate(() => document.body.innerText.trim().length);
    if (visible < 30) throw new Error('Pantalla en blanco');
  });

  await browser.close();
  const fallidas = resultados.filter((r) => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallidas.length}/${resultados.length} pruebas correctas`);
  if (fallidas.length) { console.log(`Capturas de las fallidas en: ${CARPETA_CAPTURAS}`); process.exit(1); }
})().catch((e) => { console.error('Fallo general:', e); process.exit(2); });
