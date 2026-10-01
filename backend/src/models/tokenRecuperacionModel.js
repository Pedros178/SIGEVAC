const { query } = require('../config/database');

const TokenRecuperacionModel = {
  async crear({ usuarioId, tokenHash, expiraEn }) {
    const { rows } = await query(
      `INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [usuarioId, tokenHash, expiraEn]
    );
    return rows[0];
  },

  async buscarValido(tokenHash) {
    const { rows } = await query(
      `SELECT * FROM tokens_recuperacion
       WHERE token_hash = $1 AND usado = false AND expira_en > now()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  /**
   * Consume el token en UNA sola sentencia atómica: dos peticiones
   * simultáneas con el mismo token no pueden ganar ambas.
   */
  async consumirValido(tokenHash) {
    const { rows } = await query(
      `UPDATE tokens_recuperacion SET usado = true
       WHERE token_hash = $1 AND usado = false AND expira_en > now()
       RETURNING *`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async marcarUsado(id) {
    await query(`UPDATE tokens_recuperacion SET usado = true WHERE id = $1`, [id]);
  },
};

module.exports = TokenRecuperacionModel;
