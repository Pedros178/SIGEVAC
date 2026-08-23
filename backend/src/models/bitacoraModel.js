const { query } = require('../config/database');

const BitacoraModel = {
  async crear({ usuarioId, evento, contexto }) {
    await query(
      `INSERT INTO bitacora (usuario_id, evento, contexto) VALUES ($1,$2,$3)`,
      [usuarioId || null, evento, contexto ? JSON.stringify(contexto) : null]
    );
  },

  async listar({ usuarioId, evento, limit = 50, offset = 0 }) {
    const { rows } = await query(
      `SELECT * FROM bitacora
       WHERE ($1::uuid IS NULL OR usuario_id = $1)
         AND ($2::text IS NULL OR evento = $2)
       ORDER BY creado_en DESC
       LIMIT $3 OFFSET $4`,
      [usuarioId || null, evento || null, limit, offset]
    );
    return rows;
  },
};

module.exports = BitacoraModel;
