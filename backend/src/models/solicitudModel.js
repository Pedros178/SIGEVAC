const { query } = require('../config/database');
const SolicitudModel = {
  async crear({ asociacionId, nombre, correo, telefono, mensaje, versionAviso }) {
    const { rows } = await query(`INSERT INTO solicitudes_voluntariado (asociacion_id,nombre,correo,telefono,mensaje,version_aviso,aviso_aceptado_en) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`, [asociacionId, nombre, correo.toLowerCase().trim(), telefono || null, mensaje || null, versionAviso || null]);
    return rows[0];
  },
  async listar(asociacionId, estado) {
    const { rows } = await query(`SELECT s.*, u.nombre AS revisada_por_nombre FROM solicitudes_voluntariado s LEFT JOIN usuarios u ON u.id = s.revisada_por WHERE s.asociacion_id = $1 AND ($2::text IS NULL OR s.estado = $2) ORDER BY s.creado_en DESC`, [asociacionId, estado || null]);
    return rows;
  },
  async actualizarEstado(id, asociacionId, estado, usuarioId) {
    const { rows } = await query(`UPDATE solicitudes_voluntariado SET estado = $3, revisada_por = $4, revisada_en = now() WHERE id = $1 AND asociacion_id = $2 RETURNING *`, [id, asociacionId, estado, usuarioId]);
    return rows[0] || null;
  },
};
module.exports = SolicitudModel;
