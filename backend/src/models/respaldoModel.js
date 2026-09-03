const { query } = require('../config/database');

const RespaldoModel = {
  async crear({ archivoUrl, tamanoBytes, generadoPor }) {
    const { rows } = await query(
      `INSERT INTO respaldos (archivo_url, tamano_bytes, generado_por) VALUES ($1,$2,$3) RETURNING *`,
      [archivoUrl, tamanoBytes, generadoPor || null]
    );
    return rows[0];
  },

  async listar(limit = 20) {
    const { rows } = await query(
      `SELECT r.*, u.nombre AS generado_por_nombre
       FROM respaldos r LEFT JOIN usuarios u ON u.id = r.generado_por
       ORDER BY r.creado_en DESC LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async obtenerPorId(id) {
    const { rows } = await query(`SELECT * FROM respaldos WHERE id = $1`, [id]);
    return rows[0] || null;
  },
};

module.exports = RespaldoModel;
