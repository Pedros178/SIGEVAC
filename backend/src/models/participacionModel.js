const { query } = require('../config/database');

const ParticipacionModel = {
  async inscribir(actividadId, voluntarioId) {
    const { rows } = await query(
      `INSERT INTO participaciones (actividad_id, voluntario_id)
       VALUES ($1, $2)
       ON CONFLICT (actividad_id, voluntario_id) DO NOTHING
       RETURNING *`,
      [actividadId, voluntarioId]
    );
    if (rows[0]) return { participacion: rows[0], yaExistia: false };
    const existente = await query(
      `SELECT * FROM participaciones WHERE actividad_id = $1 AND voluntario_id = $2`,
      [actividadId, voluntarioId]
    );
    return { participacion: existente.rows[0], yaExistia: true };
  },

  async listarPorActividad(actividadId) {
    const { rows } = await query(
      `SELECT p.id AS participacion_id, p.inscrito_en,
              v.id AS voluntario_id, v.numero_voluntario, v.nombre, v.apellido_paterno, v.apellido_materno,
              asi.id AS asistencia_id, asi.hora_entrada, asi.hora_salida, asi.horas_realizadas, asi.observaciones
       FROM participaciones p
       JOIN voluntarios v ON v.id = p.voluntario_id
       LEFT JOIN asistencias asi ON asi.participacion_id = p.id
       WHERE p.actividad_id = $1
       ORDER BY v.nombre`,
      [actividadId]
    );
    return rows;
  },

  async listarPorVoluntario(voluntarioId) {
    const { rows } = await query(
      `SELECT p.id AS participacion_id, a.id AS actividad_id, a.nombre AS actividad_nombre,
              a.fecha, asi.horas_realizadas
       FROM participaciones p
       JOIN actividades a ON a.id = p.actividad_id
       LEFT JOIN asistencias asi ON asi.participacion_id = p.id
       WHERE p.voluntario_id = $1
       ORDER BY a.fecha DESC`,
      [voluntarioId]
    );
    return rows;
  },

  async obtenerPorId(id) {
    const { rows } = await query(
      `SELECT p.*, v.asociacion_id
       FROM participaciones p
       JOIN voluntarios v ON v.id = p.voluntario_id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async cancelar(id) {
    await query(`DELETE FROM participaciones WHERE id = $1`, [id]);
  },
};

module.exports = ParticipacionModel;
