const { query } = require('../config/database');

const CredencialModel = {
  async generar(voluntarioId, vigenciaMeses = 12) {
    const { rows } = await query(
      `INSERT INTO credenciales (voluntario_id, vigente_desde, vigente_hasta)
       VALUES ($1, CURRENT_DATE, CURRENT_DATE + ($2 || ' months')::interval)
       ON CONFLICT (voluntario_id) DO UPDATE
         SET vigente_desde = CURRENT_DATE,
             vigente_hasta = CURRENT_DATE + ($2 || ' months')::interval,
             activa = true
       RETURNING *`,
      [voluntarioId, vigenciaMeses]
    );
    return rows[0];
  },

  async obtenerPorVoluntario(voluntarioId) {
    const { rows } = await query(`SELECT * FROM credenciales WHERE voluntario_id = $1`, [voluntarioId]);
    return rows[0] || null;
  },
};

module.exports = CredencialModel;
