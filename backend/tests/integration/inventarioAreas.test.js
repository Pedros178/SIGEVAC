const fs = require('fs');
const path = require('path');
const { app, request, loginComoAdmin } = require('./helpers');
const { query } = require('../../src/config/database');

const AREAS_OFICIALES = [
  'Administrativa', 'Arte y Cultura', 'Deporte', 'Trabajo Social', 'Ciencia y Tecnología', 'Educación', 'Salud',
  'Recursos Naturales y Medio Ambiente', 'Asesoría Jurídica', 'Apoyo al Comercio y Emprendimiento', 'Comunicación',
  'Inclusión y Participación Cívica', 'Centros de Desarrollo Integral Comunitarios HUITZILIN', 'Diversidad Sexual',
  'Recreación', 'Difusión Gastronómica', 'Programación de Servicio Social y Prácticas Profesionales', 'Sistemas',
  'Bibliotecas', 'Pueblos y Barrios Originarios', 'Promoción', 'Seguridad, Prevención y Protección Civil',
  'Derechos Humanos', 'Administración Estratégica', 'Relaciones Públicas', 'Vinculación y Empleabilidad',
  'Desarrollo Rural', 'Diseño de Moda e Imagen Integral', 'Asuntos Lingüísticos',
];

describe('Inventario organizado por áreas de la asociación', () => {
  let token;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => { token = (await loginComoAdmin()).access_token; });

  test('el inventario ofrece las 30 áreas de labor oficiales y Control de Voluntariado', async () => {
    const respuesta = await request(app).get('/api/inventario/categorias').set(auth());
    expect(respuesta.status).toBe(200);
    const nombres = respuesta.body.categorias.map((c) => c.nombre);
    for (const area of [...AREAS_OFICIALES, 'Control de Voluntariado']) expect(nombres).toContain(area);
    expect(nombres).not.toContain('Vestuario');
    expect(nombres).not.toContain('Equipo y mobiliario');
    const arte = respuesta.body.categorias.find((c) => c.nombre === 'Arte y Cultura');
    expect(arte.subcategorias.map((s) => s.nombre)).toEqual(expect.arrayContaining(['Sombreros', 'Escenografía']));
  });

  test('la migración 021 reubica "Vestuario" bajo "Arte y Cultura" sin perder artículos ni subáreas, y es idempotente', async () => {
    const { rows: [asoc] } = await query(`SELECT id FROM asociaciones ORDER BY creado_en LIMIT 1`);
    const sufijo = Date.now();
    // Estado "antiguo": categoría Vestuario con la subcategoría Gorras y un artículo dentro
    const { rows: [vestuario] } = await query(
      `INSERT INTO inventario_categorias (asociacion_id, nombre) VALUES ($1, 'Vestuario') RETURNING id`, [asoc.id]);
    const { rows: [gorras] } = await query(
      `INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES ($1, $2, $3) RETURNING id`,
      [asoc.id, `Gorras ${sufijo}`, vestuario.id]);
    const { rows: [articulo] } = await query(
      `INSERT INTO inventario_articulos (asociacion_id, nombre, categoria_id, subcategoria_id)
       VALUES ($1, $2, $3, $4) RETURNING id`, [asoc.id, `Gorra de prueba ${sufijo}`, vestuario.id, gorras.id]);

    const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations/021_inventario_por_areas.sql'), 'utf8');
    await query(sql);
    await query(sql); // segunda ejecución: no debe fallar ni duplicar

    const { rows: [arte] } = await query(
      `SELECT id FROM inventario_categorias WHERE asociacion_id = $1 AND categoria_padre_id IS NULL AND nombre = 'Arte y Cultura'`, [asoc.id]);
    const { rows: [despues] } = await query(
      `SELECT categoria_id, subcategoria_id FROM inventario_articulos WHERE id = $1`, [articulo.id]);
    expect(despues.categoria_id).toBe(arte.id);
    expect(despues.subcategoria_id).toBe(gorras.id);
    const { rows: [subarea] } = await query(`SELECT categoria_padre_id FROM inventario_categorias WHERE id = $1`, [gorras.id]);
    expect(subarea.categoria_padre_id).toBe(arte.id);
    const { rows: restos } = await query(
      `SELECT 1 FROM inventario_categorias WHERE asociacion_id = $1 AND categoria_padre_id IS NULL AND nombre = 'Vestuario'`, [asoc.id]);
    expect(restos).toHaveLength(0);
    const { rows: duplicadas } = await query(
      `SELECT nombre FROM inventario_categorias WHERE asociacion_id = $1 AND categoria_padre_id IS NULL
       GROUP BY nombre HAVING count(*) > 1`, [asoc.id]);
    expect(duplicadas).toHaveLength(0);
  });
});
