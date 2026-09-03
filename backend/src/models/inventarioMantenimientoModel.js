const { query } = require('../config/database');

const InventarioMantenimientoModel = {
  async listarPorArticulo(articuloId) {
    const { rows } = await query(
      `SELECT * FROM inventario_mantenimientos WHERE articulo_id = $1 ORDER BY fecha DESC`,
      [articuloId]
    );
    return rows;
  },

  async crear({ articuloId, tipo, descripcion, fecha, responsable, costo, registradoPor }) {
    const { rows } = await query(
      `INSERT INTO inventario_mantenimientos (articulo_id, tipo, descripcion, fecha, responsable, costo, registrado_por)
       VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6,$7) RETURNING *`,
      [articuloId, tipo, descripcion || null, fecha || null, responsable || null, costo || null, registradoPor || null]
    );
    return rows[0];
  },
};
module.exports = InventarioMantenimientoModel;
