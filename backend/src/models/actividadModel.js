const { query } = require('../config/database');

const ActividadModel = {
  async crear({ asociacionId, nombre, fecha, horaInicio, horaFin, estado, lugar, responsableId, descripcion, cupo }) {
    const { rows } = await query(
      `INSERT INTO actividades (asociacion_id, nombre, fecha, hora_inicio, hora_fin, estado, lugar, responsable_id, descripcion, cupo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [asociacionId, nombre, fecha, horaInicio || null, horaFin || null, estado || 'programada', lugar || null, responsableId || null, descripcion || null, cupo || null]
    );
    return rows[0];
  },

  async listar({ asociacionId, desde, hasta, limit = 50, offset = 0 }) {
    const { rows } = await query(
      `SELECT a.*, u.nombre AS responsable_nombre,
              (SELECT COUNT(*) FROM participaciones p WHERE p.actividad_id = a.id) AS total_inscritos
       FROM actividades a
       LEFT JOIN usuarios u ON u.id = a.responsable_id
       WHERE a.asociacion_id = $1
         AND ($2::date IS NULL OR a.fecha >= $2)
         AND ($3::date IS NULL OR a.fecha <= $3)
       ORDER BY a.fecha DESC
       LIMIT $4 OFFSET $5`,
      [asociacionId, desde || null, hasta || null, limit, offset]
    );
    return rows;
  },

  async obtenerPorId(id) {
    const { rows } = await query(
      `SELECT a.*, u.nombre AS responsable_nombre
       FROM actividades a
       LEFT JOIN usuarios u ON u.id = a.responsable_id
       WHERE a.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async actualizar(id, campos) {
    const permitidos = ['nombre', 'fecha', 'hora_inicio', 'hora_fin', 'estado', 'lugar', 'responsable_id', 'descripcion', 'cupo'];
    const sets = [];
    const valores = [];
    let i = 1;
    for (const campo of permitidos) {
      if (campos[campo] !== undefined) {
        sets.push(`${campo} = $${i}`);
        valores.push(campos[campo]);
        i += 1;
      }
    }
    if (sets.length === 0) return this.obtenerPorId(id);
    valores.push(id);
    const { rows } = await query(`UPDATE actividades SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, valores);
    return rows[0];
  },

  async agregarEvidencia(actividadId, { url, descripcion }) {
    const { rows } = await query(
      `INSERT INTO evidencias (actividad_id, url, descripcion) VALUES ($1,$2,$3) RETURNING *`,
      [actividadId, url, descripcion || null]
    );
    return rows[0];
  },

  async listarEvidencias(actividadId) {
    const { rows } = await query(
      `SELECT * FROM evidencias WHERE actividad_id = $1 ORDER BY creado_en DESC`,
      [actividadId]
    );
    return rows;
  },
};

module.exports = ActividadModel;
