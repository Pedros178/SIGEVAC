const ExcelJS = require('exceljs');
const { request, app, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');
const { aCsv, aXlsx, neutralizarFormula } = require('../../src/utils/exportadores');

const PW = 'Victima#Segura77';
const unico = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let admin;
const H = (t) => ({ Authorization: `Bearer ${t}` });
async function nuevaAsoc() {
  return (await request(app).post('/api/asociacion').set(H(admin.access_token)).send({ nombre: `Asoc ${unico()}` })).body.asociacion.id;
}
async function coordinadorEn(asocId) {
  const correo = `x${unico()}@t.local`;
  const r = await request(app).post('/api/usuarios').set(H(admin.access_token)).send({ nombre: 'C', correo, password: PW, rol: 'coordinador' });
  await query('DELETE FROM usuario_asociaciones WHERE usuario_id = $1', [r.body.usuario.id]);
  await query('INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada) VALUES ($1,$2,true)', [r.body.usuario.id, asocId]);
  await query('UPDATE usuarios SET asociacion_id = $2 WHERE id = $1', [r.body.usuario.id, asocId]);
  return (await request(app).post('/api/auth/login').send({ correo, password: PW })).body.access_token;
}
beforeAll(async () => { admin = await loginComoAdmin(); });

describe('N-03 SKU de inventario único por asociación', () => {
  test('dos asociaciones pueden crear artículos en paralelo sin colisiones (antes: 409 aleatorios)', async () => {
    const [ta, tb] = await Promise.all([nuevaAsoc().then(coordinadorEn), nuevaAsoc().then(coordinadorEn)]);
    const crear = (t, i) => request(app).post('/api/inventario').set(H(t)).send({ nombre: `Art ${i} ${unico()}`, unidad: 'pza' });
    const resultados = await Promise.all([...Array(5)].flatMap((_, i) => [crear(ta, i), crear(tb, i)]));
    expect(resultados.map((r) => r.status)).toEqual(Array(10).fill(201));
    const skus = resultados.map((r) => r.body.articulo.sku);
    expect(skus.filter((s) => s.endsWith('-0001'))).toHaveLength(2); // cada asociación empieza en 0001
  });
  test('tras borrar un artículo intermedio no se repite el consecutivo', async () => {
    const t = await nuevaAsoc().then(coordinadorEn);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await request(app).post('/api/inventario').set(H(t)).send({ nombre: `Borrar ${i} ${unico()}`, unidad: 'pza' })).body.articulo.id);
    await query('DELETE FROM inventario_articulos WHERE id = $1', [ids[0]]);
    expect((await request(app).post('/api/inventario').set(H(t)).send({ nombre: `Nuevo ${unico()}`, unidad: 'pza' })).status).toBe(201);
  });
});

describe('N-02 inyección de fórmulas en exportaciones', () => {
  test('neutralizarFormula antepone apóstrofo a =, +, -, @ pero respeta números', () => {
    expect(neutralizarFormula('=HYPERLINK("http://x","y")')).toBe(`'=HYPERLINK("http://x","y")`);
    expect(neutralizarFormula('+cmd|calc')).toBe("'+cmd|calc");
    expect(neutralizarFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizarFormula('-2+3')).toBe("'-2+3");
    expect(neutralizarFormula('-5')).toBe('-5');
    expect(neutralizarFormula(-5)).toBe(-5);
    expect(neutralizarFormula('Juan Pérez')).toBe('Juan Pérez');
  });
  test('aCsv no deja ninguna celda que empiece con carácter de fórmula', () => {
    const csv = aCsv({ columnas: [{ key: 'n', label: 'Nombre' }], filas: [{ n: '=1+1' }, { n: '@x' }, { n: 'ok' }] });
    expect(csv).toContain("'=1+1");
    expect(csv.split('\r\n').slice(1).every((l) => !/^[=+\-@]/.test(l))).toBe(true);
  });
  test('en XLSX el texto "=..." queda como TEXTO, no como fórmula', async () => {
    const buf = await aXlsx({ titulo: 'T', columnas: [{ key: 'n', label: 'Nombre' }], filas: [{ n: '=1+1' }] });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const celda = wb.worksheets[0].getCell('A2');
    expect(celda.type).toBe(ExcelJS.ValueType.String);
    expect(celda.formula).toBeUndefined();
  });
  test('el reporte CSV real de voluntarios exporta la fórmula neutralizada', async () => {
    const t = await nuevaAsoc().then(coordinadorEn);
    await request(app).post('/api/voluntarios').set(H(t)).send({ nombre: '=HYPERLINK("http://evil.example","x")', fechaNacimiento: '1990-01-01' });
    const r = await request(app).get('/api/reportes/voluntarios-activos?formato=csv').set(H(t));
    expect(r.status).toBe(200);
    expect(r.text).toContain(`'=HYPERLINK`);
    expect(r.text.split(/\r?\n/).some((l) => /,"?=HYPERLINK/.test(l))).toBe(false);
  });
});

describe('Préstamos: los vínculos deben ser de la misma asociación y los datos válidos', () => {
  let tA; let tB; let artB; let volA; let actA; const manana = new Date(Date.now() + 864e5).toLocaleDateString('en-CA');
  beforeAll(async () => {
    [tA, tB] = await Promise.all([nuevaAsoc().then(coordinadorEn), nuevaAsoc().then(coordinadorEn)]);
    volA = (await request(app).post('/api/voluntarios').set(H(tA)).send({ nombre: 'Vol A', fechaNacimiento: '1990-01-01' })).body.voluntario.id;
    actA = (await request(app).post('/api/actividades').set(H(tA)).send({ nombre: 'Act A', fecha: '2027-01-01' })).body.actividad.id;
    artB = (await request(app).post('/api/inventario').set(H(tB)).send({ nombre: `Prestable ${unico()}`, unidad: 'pza', es_prestable: true })).body.articulo.id;
    await request(app).post(`/api/inventario/${artB}/movimientos`).set(H(tB)).send({ tipo: 'entrada', cantidad: 5 });
  });
  const pedir = (extra) => request(app).post('/api/inventario/prestamos').set(H(tB))
    .send({ articulo_id: artB, cantidad: 1, responsable: 'Resp', fecha_devolucion_programada: manana, ...extra });
  test('préstamo válido', async () => { expect((await pedir({})).status).toBe(201); });
  test('no se puede vincular un voluntario de otra asociación', async () => { expect((await pedir({ voluntario_id: volA })).status).toBe(404); });
  test('no se puede vincular una actividad de otra asociación', async () => { expect((await pedir({ actividad_id: actA })).status).toBe(404); });
  const casosInvalidos = [['fecha ilegible', { fecha_devolucion_programada: 'mañana' }], ['fecha pasada', { fecha_devolucion_programada: '2000-01-01' }],
    ['cantidad gigante', { cantidad: 1e9 }], ['voluntario_id no UUID', { voluntario_id: 'abc' }], ['responsable no texto', { responsable: { a: 1 } }]];
  test.each(casosInvalidos)('%s → 400', async (_n, extra) => { expect((await pedir(extra)).status).toBe(400); });
});

describe('N-04 búsqueda de voluntarios', () => {
  test('encuentra por apellido, nombre completo, correo y folio; los comodines se tratan literalmente', async () => {
    const t = await nuevaAsoc().then(coordinadorEn);
    const s = unico();
    const alta = await request(app).post('/api/voluntarios').set(H(t))
      .send({ nombre: 'Guadalupe', apellidoPaterno: `Zamudio${s}`, apellidoMaterno: 'Ibarra', correo: `gz${s}@x.com`, fechaNacimiento: '1990-01-01' });
    const folio = alta.body.voluntario.numero_voluntario;
    const buscar = async (q) => (await request(app).get(`/api/voluntarios?busqueda=${encodeURIComponent(q)}`).set(H(t))).body.voluntarios.length;
    expect(await buscar(`Zamudio${s}`)).toBe(1);
    expect(await buscar(`guadalupe zamudio${s}`)).toBe(1); // varias palabras, en cualquier columna
    expect(await buscar(`gz${s}@x.com`)).toBe(1);
    expect(await buscar(folio)).toBe(1);
    expect(await buscar('%')).toBe(0); // antes: '%' coincidía con TODO
    expect(await buscar('inexistente_xyz')).toBe(0);
  });
});
