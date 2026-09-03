const { query, getClient } = require('../config/database');
const HoraServicioModel = require('./horaServicioModel');

const AsistenciaModel = {
  async obtenerPorParticipacion(participacionId) {
    const { rows } = await query(`SELECT * FROM asistencias WHERE participacion_id = $1`, [participacionId]);
    return rows[0] || null;
  },

  /**
   * @param {string|null} horaCliente ISO 8601 opcional: se usa cuando la
   * acción se registró sin conexión y se sincroniza después (modo offline),
   * para no perder la hora real del evento. Sin este valor, se usa la hora
   * del servidor como siempre.
   */
  async registrarEntrada(participacionId, horaCliente = null) {
    const existente = await this.obtenerPorParticipacion(participacionId);
    if (existente) return existente;
    const { rows } = await query(
      `INSERT INTO asistencias (participacion_id, hora_entrada) VALUES ($1, COALESCE($2::timestamptz, now()))
       ON CONFLICT (participacion_id) DO UPDATE SET participacion_id = EXCLUDED.participacion_id
       RETURNING *`,
      [participacionId, horaCliente]
    );
    return rows[0];
  },

  /**
   * Registra la hora de salida, calcula las horas realizadas y las acumula
   * en horas_servicio (Módulo 12) dentro de una misma transacción.
   *
   * @param {string|null} horaCliente ISO 8601 opcional (modo offline): si
   * se provee, se usa como hora real de salida en vez de now(), para que
   * las horas calculadas correspondan al momento real del evento y no al
   * momento en que el dispositivo recuperó conexión.
   */
  async registrarSalida(participacionId, voluntarioId, observaciones, horaCliente = null) {
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
      if (horaCliente && asistencia.hora_entrada && new Date(horaCliente) < new Date(asistencia.hora_entrada)) {
        throw Object.assign(new Error('La hora de salida no puede ser anterior a la hora de entrada.'), { status: 400 });
      }

      const { rows: actualizadas } = await client.query(
        `UPDATE asistencias
         SET hora_salida = COALESCE($2::timestamptz, now()),
             horas_realizadas = ROUND(EXTRACT(EPOCH FROM (COALESCE($2::timestamptz, now()) - hora_entrada)) / 3600.0, 2),
             observaciones = COALESCE($3, observaciones)
         WHERE participacion_id = $1
         RETURNING *`,
        [participacionId, horaCliente, observaciones || null]
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
