const { query, getClient } = require('../config/database');

const InventarioModel = {
  async listar(asociacionId) {
    const { rows } = await query(`SELECT * FROM inventario_articulos WHERE asociacion_id = $1 ORDER BY nombre`, [asociacionId]);
    return rows;
  },
  async crear({ asociacionId, nombre, descripcion, unidad, minimo }) {
    const { rows } = await query(`INSERT INTO inventario_articulos (asociacion_id,nombre,descripcion,unidad,minimo) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [asociacionId, nombre, descripcion || null, unidad || 'pieza', minimo || 0]);
    return rows[0];
  },
  async movimiento({ articuloId, usuarioId, tipo, cantidad, motivo }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM inventario_articulos WHERE id = $1 FOR UPDATE`, [articuloId]);
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
};
module.exports = InventarioModel;
