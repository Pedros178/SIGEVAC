const { query } = require('../config/database');

const AuditoriaModel = {
  async crear({ usuarioId, accion, moduloAfectado, entidadId, detalle, ip }) {
    await query(
      `INSERT INTO auditoria (usuario_id, accion, modulo_afectado, entidad_id, detalle, ip)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [usuarioId || null, accion, moduloAfectado || null, entidadId || null, detalle ? JSON.stringify(detalle) : null, ip || null]
    );
  },

  /**
   * Lista auditoría filtrando por asociación (a través del usuario que ejecutó
   * la acción), con filtros opcionales de módulo y usuario.
   */
  async listar({ asociacionId, moduloAfectado, usuarioId, limit = 50, offset = 0 }) {
    const { rows } = await query(
      `SELECT a.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo
       FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE ($1::uuid IS NULL OR u.asociacion_id = $1)
         AND ($2::text IS NULL OR a.modulo_afectado = $2)
         AND ($3::uuid IS NULL OR a.usuario_id = $3)
       ORDER BY a.creado_en DESC
       LIMIT $4 OFFSET $5`,
      [asociacionId || null, moduloAfectado || null, usuarioId || null, limit, offset]
    );
    return rows;
  },
};

module.exports = AuditoriaModel;
