const crypto = require('crypto');
const { query } = require('../config/database');

const QrModel = {
  async obtenerOCrear(voluntarioId) {
    const { rows: existentes } = await query(`SELECT * FROM qr_codigos WHERE voluntario_id = $1`, [voluntarioId]);
    if (existentes[0]) return existentes[0];

    const codigo = crypto.randomBytes(16).toString('hex');
    const { rows } = await query(
      `INSERT INTO qr_codigos (voluntario_id, codigo) VALUES ($1, $2) RETURNING *`,
      [voluntarioId, codigo]
    );
    return rows[0];
  },

  /**
   * Consulta el voluntario asociado a un código QR — usado para validar
   * identidad y registrar asistencia escaneando la credencial (Módulo 14).
   */
  async buscarVoluntarioPorCodigo(codigo) {
    const { rows } = await query(
      `SELECT v.id, v.numero_voluntario, v.nombre, v.apellido_paterno, v.apellido_materno, v.activo
       FROM qr_codigos q
       JOIN voluntarios v ON v.id = q.voluntario_id
       WHERE q.codigo = $1`,
      [codigo]
    );
    return rows[0] || null;
  },
};

module.exports = QrModel;
