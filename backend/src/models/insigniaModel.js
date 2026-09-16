const { query } = require('../config/database');

const InsigniaModel = {
  async listarCatalogo() {
    const { rows } = await query(`SELECT * FROM insignias ORDER BY orden ASC`);
    return rows;
  },

  async listarPorVoluntario(voluntarioId) {
    const { rows } = await query(
      `SELECT i.*, vi.obtenida_en
       FROM voluntario_insignias vi
       JOIN insignias i ON i.id = vi.insignia_id
       WHERE vi.voluntario_id = $1
       ORDER BY vi.obtenida_en DESC`,
      [voluntarioId]
    );
    return rows;
  },

  async clavesObtenidas(voluntarioId) {
    const { rows } = await query(
      `SELECT i.clave FROM voluntario_insignias vi
       JOIN insignias i ON i.id = vi.insignia_id
       WHERE vi.voluntario_id = $1`,
      [voluntarioId]
    );
    return new Set(rows.map((r) => r.clave));
  },

  /**
   * Otorga una insignia si el voluntario aún no la tiene. Idempotente:
   * se puede volver a evaluar el mismo voluntario sin duplicar registros
   * ni lanzar error si ya la tenía.
   */
  async otorgar(voluntarioId, insigniaId) {
    const { rows } = await query(
      `INSERT INTO voluntario_insignias (voluntario_id, insignia_id)
       VALUES ($1, $2)
       ON CONFLICT (voluntario_id, insignia_id) DO NOTHING
       RETURNING *`,
      [voluntarioId, insigniaId]
    );
    return rows[0] || null; // null si ya la tenía
  },

  /**
   * Reúne las métricas necesarias para evaluar todos los criterios de
   * insignias soportados, en una sola consulta por métrica.
   */
  async obtenerMetricas(voluntarioId) {
    const { rows: horasRows } = await query(
      `SELECT COALESCE(SUM(horas_acumuladas), 0) AS total
       FROM horas_servicio WHERE voluntario_id = $1`,
      [voluntarioId]
    );

    const { rows: actividadesRows } = await query(
      `SELECT COUNT(*) AS total
       FROM asistencias a
       JOIN participaciones p ON p.id = a.participacion_id
       WHERE p.voluntario_id = $1 AND a.hora_salida IS NOT NULL`,
      [voluntarioId]
    );

    const { rows: voluntarioRows } = await query(
      `SELECT fecha_ingreso FROM voluntarios WHERE id = $1`,
      [voluntarioId]
    );
    const fechaIngreso = voluntarioRows[0]?.fecha_ingreso || null;
    const antiguedadMeses = fechaIngreso
      ? Math.floor((Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : 0;

    // Racha: meses consecutivos (hasta el actual) con al menos una hora
    // de servicio acumulada, usando el mismo formato de periodo AAAA-MM
    // que ya usa horas_servicio.
    const { rows: periodosRows } = await query(
      `SELECT DISTINCT periodo FROM horas_servicio
       WHERE voluntario_id = $1 AND horas_acumuladas > 0
       ORDER BY periodo DESC`,
      [voluntarioId]
    );
    const periodos = new Set(periodosRows.map((r) => r.periodo));
    let racha = 0;
    let cursor = new Date();
    for (;;) {
      const claveMes = cursor.toISOString().slice(0, 7);
      if (!periodos.has(claveMes)) break;
      racha += 1;
      cursor.setMonth(cursor.getMonth() - 1);
    }

    return {
      horas_totales: Number(horasRows[0].total),
      actividades_completadas: Number(actividadesRows[0].total),
      antiguedad_meses: antiguedadMeses,
      racha_meses: racha,
    };
  },
};

module.exports = InsigniaModel;
