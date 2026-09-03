const { query } = require('../config/database');

const ConfiguracionModel = {
  async listar(asociacionId) {
    const { rows } = await query(
      `SELECT clave, valor FROM configuracion WHERE asociacion_id = $1 ORDER BY clave`,
      [asociacionId]
    );
    return rows;
  },

  async obtener(asociacionId, clave) {
    const { rows } = await query(
      `SELECT clave, valor FROM configuracion WHERE asociacion_id = $1 AND clave = $2`,
      [asociacionId, clave]
    );
    return rows[0] || null;
  },

  async establecer(asociacionId, clave, valor) {
    const { rows } = await query(
      `INSERT INTO configuracion (asociacion_id, clave, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (asociacion_id, clave) DO UPDATE SET valor = $3
       RETURNING clave, valor`,
      [asociacionId, clave, JSON.stringify(valor)]
    );
    return rows[0];
  },
};

module.exports = ConfiguracionModel;
