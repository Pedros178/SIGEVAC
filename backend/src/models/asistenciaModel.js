const { query, getClient } = require('../config/database');
const HoraServicioModel = require('./horaServicioModel');

const AsistenciaModel = {
  async obtenerPorParticipacion(participacionId) {
    const { rows } = await query(`SELECT * FROM asistencias WHERE participacion_id = $1`, [participacionId]);
    return rows[0] || null;
  },

  async registrarEntrada(participacionId) {
    const existente = await this.obtenerPorParticipacion(participacionId);
    if (existente) return existente;
    const { rows } = await query(
      `INSERT INTO asistencias (participacion_id, hora_entrada) VALUES ($1, now()) RETURNING *`,
      [participacionId]
    );
    return rows[0];
  },

  /**
   * Registra la hora de salida, calcula las horas realizadas y las acumula
   * en horas_servicio (Módulo 12) dentro de una misma transacción.
   */
  async registrarSalida(participacionId, voluntarioId, observaciones) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: asistenciaRows } = await client.query(
        `SELECT * FROM asistencias WHERE participacion_id = $1 FOR UPDATE`,
        [participacionId]
      );
      const asistencia = asistenciaRows[0];
      if (!asistencia) {
        throw Object.assign(new Error('No se ha registrado la entrada de este voluntario.'), { status: 400 });
      }
      if (asistencia.hora_salida) {
        throw Object.assign(new Error('La salida de esta participación ya fue registrada.'), { status: 409 });
      }

      const { rows: actualizadas } = await client.query(
        `UPDATE asistencias
         SET hora_salida = now(),
             horas_realizadas = ROUND(EXTRACT(EPOCH FROM (now() - hora_entrada)) / 3600.0, 2),
             observaciones = COALESCE($2, observaciones)
         WHERE participacion_id = $1
         RETURNING *`,
        [participacionId, observaciones || null]
      );
      const actualizada = actualizadas[0];

      await HoraServicioModel.acumular(client, {
        voluntarioId,
        horas: actualizada.horas_realizadas,
        fecha: actualizada.hora_salida,
      });

      await client.query('COMMIT');
      return actualizada;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = AsistenciaModel;
