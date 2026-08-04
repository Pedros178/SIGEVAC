const { query } = require('../config/database');

const BitacoraModel = {
  async crear({ usuarioId, evento, contexto }) {
    await query(
      `INSERT INTO bitacora (usuario_id, evento, contexto) VALUES ($1,$2,$3)`,
      [usuarioId || null, evento, contexto ? JSON.stringify(contexto) : null]
    );
  },

  async listar({ usuarioId, limit = 50, offset = 0 }) {
    const { rows } = await query(
      `SELECT * FROM bitacora
       WHERE ($1::uuid IS NULL OR usuario_id = $1)
       ORDER BY creado_en DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId || null, limit, offset]
    );
    return rows;
  },
};

module.exports = BitacoraModel;
