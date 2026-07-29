const { query } = require('../config/database');

const SesionModel = {
  async crear({ usuarioId, refreshTokenHash, ip, userAgent, expiraEn }) {
    const { rows } = await query(
      `INSERT INTO sesiones (usuario_id, refresh_token_hash, ip, user_agent, expira_en)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [usuarioId, refreshTokenHash, ip, userAgent, expiraEn]
    );
    return rows[0];
  },

  async buscarPorHash(refreshTokenHash) {
    const { rows } = await query(
      `SELECT * FROM sesiones
       WHERE refresh_token_hash = $1 AND revocado = false AND expira_en > now()`,
      [refreshTokenHash]
    );
    return rows[0] || null;
  },

  async revocar(sesionId) {
    await query(`UPDATE sesiones SET revocado = true WHERE id = $1`, [sesionId]);
  },

  async revocarTodasDeUsuario(usuarioId) {
    await query(
      `UPDATE sesiones SET revocado = true WHERE usuario_id = $1 AND revocado = false`,
      [usuarioId]
    );
  },
};

module.exports = SesionModel;
