const { query } = require('../config/database');

const RolModel = {
  async listar() {
    const { rows } = await query(`SELECT id, nombre, descripcion FROM roles ORDER BY nombre`);
    return rows;
  },

  async buscarPorNombre(nombre) {
    const { rows } = await query(`SELECT * FROM roles WHERE nombre = $1`, [nombre]);
    return rows[0] || null;
  },

  async buscarPorId(id) {
    const { rows } = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    return rows[0] || null;
  },
};

module.exports = RolModel;
