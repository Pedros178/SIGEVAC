const { query } = require('../config/database');

/**
 * Catálogos genéricos (tabla `catalogos`): listas de opciones administrables
 * (tipo de sangre, parentesco, ...) que alimentan los selects de los formularios.
 */
const CatalogoModel = {
  async listarPorTipo(tipo) {
    const { rows } = await query(
      `SELECT id, tipo, clave, etiqueta, orden FROM catalogos
       WHERE tipo = $1 ORDER BY orden, etiqueta`,
      [tipo]
    );
    return rows;
  },

  async listarTodos() {
    const { rows } = await query(
      `SELECT id, tipo, clave, etiqueta, orden FROM catalogos ORDER BY tipo, orden, etiqueta`
    );
    return rows;
  },

  async crear({ tipo, clave, etiqueta, orden }) {
    const { rows } = await query(
      `INSERT INTO catalogos (tipo, clave, etiqueta, orden) VALUES ($1, $2, $3, $4)
       RETURNING id, tipo, clave, etiqueta, orden`,
      [tipo, clave, etiqueta, orden]
    );
    return rows[0];
  },

  async actualizar(id, { etiqueta, orden }) {
    const { rows } = await query(
      `UPDATE catalogos SET etiqueta = COALESCE($2, etiqueta), orden = COALESCE($3, orden)
       WHERE id = $1 RETURNING id, tipo, clave, etiqueta, orden`,
      [id, etiqueta ?? null, orden ?? null]
    );
    return rows[0] || null;
  },

  async eliminar(id) {
    const { rowCount } = await query(`DELETE FROM catalogos WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = CatalogoModel;
