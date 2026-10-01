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
  async buscarVoluntarioPorCodigo(codigo, asociacionId) {
    // Solo se resuelve el QR de voluntarios de la asociación activa del solicitante
    const { rows } = await query(
      `SELECT v.id, v.numero_voluntario, v.nombre, v.apellido_paterno, v.apellido_materno, v.activo
       FROM qr_codigos q
       JOIN voluntarios v ON v.id = q.voluntario_id
       WHERE q.codigo = $1 AND v.asociacion_id = $2`,
      [codigo, asociacionId]
    );
    return rows[0] || null;
  },

  async obtenerCertificadoPorCodigo(codigo) {
    const { rows } = await query(
      `SELECT v.id, v.numero_voluntario, v.nombre, v.apellido_paterno, v.apellido_materno,
              v.activo, a.nombre AS asociacion_nombre,
              COALESCE(SUM(hs.horas_acumuladas), 0)::float AS total_horas
       FROM qr_codigos q
       JOIN voluntarios v ON v.id = q.voluntario_id
       JOIN asociaciones a ON a.id = v.asociacion_id
       LEFT JOIN horas_servicio hs ON hs.voluntario_id = v.id
       WHERE q.codigo = $1
       GROUP BY v.id, a.nombre`,
      [codigo]
    );
    if (!rows[0] || !rows[0].activo) return null;

    const { rows: detalle } = await query(
      `SELECT tipo, periodo, horas_acumuladas::float AS horas
       FROM horas_servicio WHERE voluntario_id = $1 ORDER BY periodo DESC, tipo`,
      [rows[0].id]
    );
    return { ...rows[0], detalle };
  },
};

module.exports = QrModel;
