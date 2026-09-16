const { query } = require('../config/database');
const { getClient } = require('../config/database');
const HoraServicioModel = require('./horaServicioModel');

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

  async asistenciaPorQr(codigo, actividadId, asociacionId) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT p.id AS participacion_id, p.voluntario_id, a.id AS actividad_id,
                a.nombre AS actividad_nombre, v.nombre, v.apellido_paterno,
                v.numero_voluntario, asi.id AS asistencia_id, asi.hora_entrada, asi.hora_salida
         FROM qr_codigos q
         JOIN voluntarios v ON v.id = q.voluntario_id
         JOIN participaciones p ON p.voluntario_id = v.id AND p.actividad_id = $2
         JOIN actividades a ON a.id = p.actividad_id AND a.asociacion_id = $3
         LEFT JOIN asistencias asi ON asi.participacion_id = p.id
         WHERE q.codigo = $1 AND v.activo = true
         FOR UPDATE OF p`,
        [codigo, actividadId, asociacionId]
      );
      const registro = rows[0];
      if (!registro) {
        await client.query('ROLLBACK');
        return null;
      }
      if (!registro.asistencia_id) {
        const entrada = await client.query(
          `INSERT INTO asistencias (participacion_id, hora_entrada) VALUES ($1, now()) RETURNING *`,
          [registro.participacion_id]
        );
        await client.query('COMMIT');
        return { tipo: 'entrada', asistencia: entrada.rows[0], voluntario: registro };
      }
      if (registro.hora_salida) {
        await client.query('ROLLBACK');
        return { yaFinalizada: true, voluntario: registro };
      }
      const salida = await client.query(
        `UPDATE asistencias SET hora_salida = now(), horas_realizadas = ROUND(EXTRACT(EPOCH FROM (now() - hora_entrada)) / 3600.0, 2) WHERE participacion_id = $1 RETURNING *`,
        [registro.participacion_id]
      );
      await HoraServicioModel.acumular(client, { voluntarioId: registro.voluntario_id, horas: salida.rows[0].horas_realizadas, fecha: salida.rows[0].hora_salida });
      await client.query('COMMIT');
      return { tipo: 'salida', asistencia: salida.rows[0], voluntario: registro };
    } catch (error) {
      await client.query('ROLLBACK'); throw error;
    } finally { client.release(); }
  },
};

module.exports = ParticipacionModel;
