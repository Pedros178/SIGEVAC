const crypto = require('crypto');
const { query, getClient } = require('../config/database');

// Genera un código QR y un SKU únicos para el artículo. El SKU usa el
// nombre de la categoría como prefijo (si existe) más un secuencial anual,
// siguiendo el mismo patrón legible que ya se usaba en el proyecto de
// activos fijos que inspiró este módulo (PREFIJO-AÑO-SECUENCIAL).
async function generarCodigos({ asociacionId, categoriaId }) {
  const year = new Date().getFullYear().toString().slice(2);
  let prefijo = 'ART';
  if (categoriaId) {
    const { rows } = await query(`SELECT nombre FROM inventario_categorias WHERE id = $1`, [categoriaId]);
    if (rows[0]?.nombre) prefijo = rows[0].nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 3).toUpperCase();
  }
  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM inventario_articulos WHERE asociacion_id = $1`, [asociacionId]
  );
  const secuencial = String(parseInt(countRows[0].count, 10) + 1).padStart(4, '0');
  const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
  return {
    sku: `${prefijo}-${year}-${secuencial}`,
    codigoQr: `SGV-INV-${year}-${sufijo}`,
  };
}

const InventarioModel = {
  async listar(asociacionId, { categoriaId, subcategoriaId, busqueda } = {}) {
    const condiciones = ['a.asociacion_id = $1', 'a.activo = true'];
    const parametros = [asociacionId];
    if (categoriaId) { parametros.push(categoriaId); condiciones.push(`a.categoria_id = $${parametros.length}`); }
    if (subcategoriaId) { parametros.push(subcategoriaId); condiciones.push(`a.subcategoria_id = $${parametros.length}`); }
    if (busqueda) { parametros.push(`%${busqueda}%`); condiciones.push(`a.nombre ILIKE $${parametros.length}`); }

    const { rows } = await query(
      `SELECT a.*, c.nombre AS categoria_nombre, sc.nombre AS subcategoria_nombre,
              foto.id AS foto_principal_id, foto.url AS foto_principal_url
       FROM inventario_articulos a
       LEFT JOIN inventario_categorias c ON c.id = a.categoria_id
       LEFT JOIN inventario_categorias sc ON sc.id = a.subcategoria_id
       LEFT JOIN LATERAL (
         SELECT id, url FROM inventario_articulo_fotos f
         WHERE f.articulo_id = a.id ORDER BY f.es_principal DESC, f.creado_en ASC LIMIT 1
       ) foto ON true
       WHERE ${condiciones.join(' AND ')}
       ORDER BY a.nombre`,
      parametros
    );
    return rows;
  },

  async obtenerPorId(id, asociacionId) {
    const { rows } = await query(
      `SELECT a.*, c.nombre AS categoria_nombre, sc.nombre AS subcategoria_nombre
       FROM inventario_articulos a
       LEFT JOIN inventario_categorias c ON c.id = a.categoria_id
       LEFT JOIN inventario_categorias sc ON sc.id = a.subcategoria_id
       WHERE a.id = $1 AND a.asociacion_id = $2`,
      [id, asociacionId]
    );
    if (!rows[0]) return null;
    const [fotos, movimientos, mantenimientos] = await Promise.all([
      query(`SELECT * FROM inventario_articulo_fotos WHERE articulo_id = $1 ORDER BY es_principal DESC, creado_en ASC`, [id]),
      query(`SELECT * FROM inventario_movimientos WHERE articulo_id = $1 ORDER BY creado_en DESC LIMIT 20`, [id]),
      query(`SELECT * FROM inventario_mantenimientos WHERE articulo_id = $1 ORDER BY fecha DESC`, [id]),
    ]);
    return { ...rows[0], fotos: fotos.rows, movimientos: movimientos.rows, mantenimientos: mantenimientos.rows };
  },

  async obtenerPorQR(codigoQr, asociacionId) {
    const { rows } = await query(
      `SELECT a.*, c.nombre AS categoria_nombre, sc.nombre AS subcategoria_nombre
       FROM inventario_articulos a
       LEFT JOIN inventario_categorias c ON c.id = a.categoria_id
       LEFT JOIN inventario_categorias sc ON sc.id = a.subcategoria_id
       WHERE a.codigo_qr = $1 AND a.asociacion_id = $2`,
      [codigoQr, asociacionId]
    );
    if (!rows[0]) return null;
    return this.obtenerPorId(rows[0].id, asociacionId);
  },

  async crear({ asociacionId, nombre, descripcion, unidad, minimo, categoriaId, subcategoriaId, estadoFisico, ubicacion, esPrestable }) {
    const { sku, codigoQr } = await generarCodigos({ asociacionId, categoriaId });
    const { rows } = await query(
      `INSERT INTO inventario_articulos
         (asociacion_id, nombre, descripcion, unidad, minimo, categoria_id, subcategoria_id, estado_fisico, ubicacion, sku, codigo_qr, es_prestable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [asociacionId, nombre, descripcion || null, unidad || 'pieza', minimo || 0,
        categoriaId || null, subcategoriaId || null, estadoFisico || 'bueno', ubicacion || null, sku, codigoQr, Boolean(esPrestable)]
    );
    return rows[0];
  },

  async actualizar(id, asociacionId, { nombre, descripcion, unidad, minimo, categoriaId, subcategoriaId, estadoFisico, ubicacion, esPrestable }) {
    const { rows } = await query(
      `UPDATE inventario_articulos SET
         nombre = COALESCE($1, nombre),
         descripcion = COALESCE($2, descripcion),
         unidad = COALESCE($3, unidad),
         minimo = COALESCE($4, minimo),
         categoria_id = COALESCE($5, categoria_id),
         subcategoria_id = COALESCE($6, subcategoria_id),
         estado_fisico = COALESCE($7, estado_fisico),
         ubicacion = COALESCE($8, ubicacion),
         es_prestable = COALESCE($9, es_prestable),
         actualizado_en = now()
       WHERE id = $10 AND asociacion_id = $11 RETURNING *`,
      [nombre, descripcion, unidad, minimo, categoriaId, subcategoriaId, estadoFisico, ubicacion,
        typeof esPrestable === 'boolean' ? esPrestable : null, id, asociacionId]
    );
    return rows[0] || null;
  },

  async movimiento({ articuloId, asociacionId, usuarioId, tipo, cantidad, motivo }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT * FROM inventario_articulos WHERE id = $1 AND asociacion_id = $2 FOR UPDATE`,
        [articuloId, asociacionId]
      );
      const articulo = rows[0];
      if (!articulo) throw Object.assign(new Error('Artículo no encontrado.'), { status: 404 });
      const delta = tipo === 'entrada' ? cantidad : -cantidad;
      if (articulo.existencias + delta < 0) throw Object.assign(new Error('No hay existencias suficientes.'), { status: 400 });
      await client.query(`UPDATE inventario_articulos SET existencias = existencias + $2, actualizado_en = now() WHERE id = $1`, [articuloId, delta]);
      const movimiento = await client.query(`INSERT INTO inventario_movimientos (articulo_id,usuario_id,tipo,cantidad,motivo) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [articuloId, usuarioId, tipo, cantidad, motivo || null]);
      await client.query('COMMIT');
      return movimiento.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },

  async agregarFoto({ articuloId, url, nombreOriginal, mimeType, subidoPor, esPrincipal }) {
    if (esPrincipal) {
      await query(`UPDATE inventario_articulo_fotos SET es_principal = false WHERE articulo_id = $1`, [articuloId]);
    }
    const { rows } = await query(
      `INSERT INTO inventario_articulo_fotos (articulo_id, url, nombre_original, mime_type, subido_por, es_principal)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [articuloId, url, nombreOriginal || null, mimeType || null, subidoPor || null, Boolean(esPrincipal)]
    );
    return rows[0];
  },

  async obtenerFotoPorId(id) {
    const { rows } = await query(`SELECT * FROM inventario_articulo_fotos WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async eliminarFoto(id, articuloId) {
    const { rows } = await query(
      `DELETE FROM inventario_articulo_fotos WHERE id = $1 AND articulo_id = $2 RETURNING *`,
      [id, articuloId]
    );
    return rows[0] || null;
  },
};
module.exports = InventarioModel;
