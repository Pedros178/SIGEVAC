const { query } = require('../config/database');

const HoraServicioModel = {
  /**
   * Determina el tipo de acumulación de horas ('servicio_social', 'residencia'
   * o 'voluntariado' por defecto) según la clasificación del voluntario
   * (Módulo 5), y suma las horas al periodo actual (formato AAAA-MM).
   */
  async acumular(ejecutor, { voluntarioId, horas, fecha }) {
    const db = ejecutor || { query };
    const periodo = new Date(fecha).toISOString().slice(0, 7); // AAAA-MM

    const { rows: tipos } = await db.query(
      `SELECT tv.clave FROM tipos_voluntario tv
       JOIN voluntarios_tipos vt ON vt.tipo_voluntario_id = tv.id
       WHERE vt.voluntario_id = $1`,
      [voluntarioId]
    );
    const claves = tipos.map((t) => t.clave);
    let tipo = 'voluntariado';
    if (claves.includes('servicio_social')) tipo = 'servicio_social';
    else if (claves.includes('residencia')) tipo = 'residencia';

    const { rows } = await db.query(
      `INSERT INTO horas_servicio (voluntario_id, tipo, periodo, horas_acumuladas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (voluntario_id, tipo, periodo)
       DO UPDATE SET horas_acumuladas = horas_servicio.horas_acumuladas + EXCLUDED.horas_acumuladas,
                     actualizado_en = now()
       RETURNING *`,
      [voluntarioId, tipo, periodo, horas]
    );
    return rows[0];
  },

  async resumenPorVoluntario(voluntarioId) {
    const { rows } = await query(
      `SELECT tipo, periodo, horas_acumuladas
       FROM horas_servicio
       WHERE voluntario_id = $1
       ORDER BY periodo DESC`,
      [voluntarioId]
    );
    const total = rows.reduce((acc, r) => acc + Number(r.horas_acumuladas), 0);
    return { detalle: rows, total_horas: total };
  },
};

module.exports = HoraServicioModel;
