const { query } = require('../config/database');

const InventarioCategoriaModel = {
  // Devuelve las categorías de primer nivel, cada una con su arreglo de
  // subcategorías anidado, para alimentar directamente un selector de
  // dos niveles en el frontend.
  async listarArbol(asociacionId) {
    const { rows } = await query(
      `SELECT id, nombre, categoria_padre_id, activo
       FROM inventario_categorias
       WHERE asociacion_id = $1
       ORDER BY categoria_padre_id NULLS FIRST, nombre`,
      [asociacionId]
    );
    const categorias = rows.filter((r) => !r.categoria_padre_id);
    return categorias.map((categoria) => ({
      ...categoria,
      subcategorias: rows.filter((r) => r.categoria_padre_id === categoria.id),
    }));
  },

  async obtenerPorId(id, asociacionId) {
    const { rows } = await query(
      `SELECT * FROM inventario_categorias WHERE id = $1 AND asociacion_id = $2`,
      [id, asociacionId]
    );
    return rows[0] || null;
  },

  async crear({ asociacionId, nombre, categoriaPadreId }) {
    const { rows } = await query(
      `INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [asociacionId, nombre, categoriaPadreId || null]
    );
    return rows[0];
  },

  async actualizar(id, asociacionId, { nombre, activo }) {
    const { rows } = await query(
      `UPDATE inventario_categorias
       SET nombre = COALESCE($1, nombre), activo = COALESCE($2, activo)
       WHERE id = $3 AND asociacion_id = $4 RETURNING *`,
      [nombre, activo, id, asociacionId]
    );
    return rows[0] || null;
  },
};
module.exports = InventarioCategoriaModel;
