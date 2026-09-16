const { query } = require('../config/database');

const NotificacionModel = {
  async crear({ usuarioId, voluntarioId, tipo, titulo, mensaje, enviadaPorCorreo }) {
    const { rows } = await query(
      `INSERT INTO notificaciones (usuario_id, voluntario_id, tipo, titulo, mensaje, enviada_por_correo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [usuarioId || null, voluntarioId || null, tipo, titulo, mensaje || null, !!enviadaPorCorreo]
    );
    return rows[0];
  },

  async listarPorUsuario(usuarioId, { soloNoLeidas = false, limit = 30 } = {}) {
    const { rows } = await query(
      `SELECT * FROM notificaciones
       WHERE usuario_id = $1 AND ($2::boolean IS FALSE OR leida = false)
       ORDER BY creado_en DESC
       LIMIT $3`,
      [usuarioId, soloNoLeidas, limit]
    );
    return rows;
  },

  async contarNoLeidas(usuarioId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM notificaciones WHERE usuario_id = $1 AND leida = false`,
      [usuarioId]
    );
    return rows[0].total;
  },

  async marcarLeida(id, usuarioId) {
    const { rows } = await query(
      `UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2 RETURNING *`,
      [id, usuarioId]
    );
    return rows[0] || null;
  },

  /**
   * Todos los usuarios activos de una asociación con al menos uno de los
   * roles indicados — usado para notificar internamente (p. ej. coordinadores)
   * de eventos como una nueva actividad.
   */
  async listarUsuariosPorAsociacion(asociacionId) {
    const { rows } = await query(
      `SELECT DISTINCT u.id FROM usuarios u WHERE u.asociacion_id = $1 AND u.activo = true`,
      [asociacionId]
    );
    return rows;
  },
};

module.exports = NotificacionModel;
