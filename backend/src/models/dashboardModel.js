const { query } = require('../config/database');

const DashboardModel = {
  async obtenerIndicadores(asociacionId) {
    const [
      totalVoluntarios, nuevosEsteMes, expedientes, actividadesDelMes,
      horasTotales, documentosFaltantes, voluntariosPorMes, horasPorMes,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM voluntarios WHERE asociacion_id = $1 AND activo = true`, [asociacionId]),
      query(
        `SELECT COUNT(*)::int AS total FROM voluntarios
         WHERE asociacion_id = $1 AND date_trunc('month', creado_en) = date_trunc('month', now())`,
        [asociacionId]
      ),
      query(
        `SELECT e.estado, COUNT(*)::int AS total
         FROM expedientes e JOIN voluntarios v ON v.id = e.voluntario_id
         WHERE v.asociacion_id = $1 GROUP BY e.estado`,
        [asociacionId]
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM actividades
         WHERE asociacion_id = $1 AND date_trunc('month', fecha) = date_trunc('month', now())`,
        [asociacionId]
      ),
      query(
        `SELECT COALESCE(SUM(hs.horas_acumuladas), 0)::float AS total
         FROM horas_servicio hs JOIN voluntarios v ON v.id = hs.voluntario_id
         WHERE v.asociacion_id = $1`,
        [asociacionId]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM documentos d
         JOIN expedientes e ON e.id = d.expediente_id
         JOIN voluntarios v ON v.id = e.voluntario_id
         WHERE v.asociacion_id = $1 AND d.estado = 'pendiente'`,
        [asociacionId]
      ),
      query(
        `SELECT to_char(date_trunc('month', creado_en), 'YYYY-MM') AS periodo,
                COUNT(*)::int AS total
         FROM voluntarios
         WHERE asociacion_id = $1 AND creado_en >= date_trunc('month', now()) - interval '5 months'
         GROUP BY 1 ORDER BY 1`,
        [asociacionId]
      ),
      query(
        `SELECT periodo, COALESCE(SUM(horas_acumuladas), 0)::float AS total
         FROM horas_servicio hs JOIN voluntarios v ON v.id = hs.voluntario_id
         WHERE v.asociacion_id = $1
           AND periodo >= to_char(date_trunc('month', now()) - interval '5 months', 'YYYY-MM')
         GROUP BY periodo ORDER BY periodo`,
        [asociacionId]
      ),
    ]);

    const conteoExpedientes = { completo: 0, en_revision: 0, incompleto: 0 };
    for (const fila of expedientes.rows) conteoExpedientes[fila.estado] = fila.total;

    return {
      total_voluntarios: totalVoluntarios.rows[0].total,
      nuevos_este_mes: nuevosEsteMes.rows[0].total,
      expedientes_completos: conteoExpedientes.completo,
      expedientes_en_revision: conteoExpedientes.en_revision,
      expedientes_incompletos: conteoExpedientes.incompleto,
      actividades_del_mes: actividadesDelMes.rows[0].total,
      horas_realizadas_total: horasTotales.rows[0].total,
      documentos_faltantes: documentosFaltantes.rows[0].total,
      voluntarios_por_mes: voluntariosPorMes.rows,
      horas_por_mes: horasPorMes.rows,
      expedientes_por_estado: Object.entries(conteoExpedientes).map(([estado, total]) => ({ estado, total })),
    };
  },
};

module.exports = DashboardModel;
