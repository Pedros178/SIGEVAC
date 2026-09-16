const { query } = require('../config/database');

const RiesgoModel = {
  /** Componentes de un solo voluntario (para el detalle individual). */
  async obtenerComponentes(voluntarioId) {
    const { rows } = await query(SQL_COMPONENTES_UNO, [voluntarioId]);
    return rows[0] ? mapearFila(rows[0]) : null;
  },

  /**
   * Componentes de todos los voluntarios ACTIVOS de una asociación, en una
   * sola consulta (evita N+1 al generar el listado/reporte completo).
   */
  async obtenerComponentesPorAsociacion(asociacionId) {
    const { rows } = await query(SQL_COMPONENTES_ASOCIACION, [asociacionId]);
    return rows.map(mapearFila);
  },
};

function mapearFila(fila) {
  return {
    voluntarioId: fila.voluntario_id,
    nombreCompleto: fila.nombre_completo,
    folio: fila.folio,
    antiguedadDias: Number(fila.antiguedad_dias),
    diasDesdeUltimaActividad: fila.dias_desde_ultima_actividad === null ? null : Number(fila.dias_desde_ultima_actividad),
    actividadesUltimos60Dias: Number(fila.actividades_ultimos_60),
    actividadesPrevias60a120Dias: Number(fila.actividades_previas_60_120),
    actividadesCompletadasTotal: Number(fila.actividades_completadas_total),
    porcentajeAvanceExpediente: Number(fila.porcentaje_avance ?? 0),
    tieneDocumentoVencido: fila.tiene_documento_vencido,
  };
}

// Subconsultas compartidas, correlacionadas por voluntario_id, reutilizadas
// tanto para un voluntario individual como para toda la asociación.
const SUBCONSULTAS = `
  EXTRACT(DAY FROM (now() - v.fecha_ingreso))::int AS antiguedad_dias,
  (
    SELECT EXTRACT(DAY FROM (now() - MAX(a.hora_salida)))::int
    FROM asistencias a JOIN participaciones p ON p.id = a.participacion_id
    WHERE p.voluntario_id = v.id AND a.hora_salida IS NOT NULL
  ) AS dias_desde_ultima_actividad,
  (
    SELECT COUNT(*) FROM asistencias a JOIN participaciones p ON p.id = a.participacion_id
    WHERE p.voluntario_id = v.id AND a.hora_salida IS NOT NULL AND a.hora_salida >= now() - INTERVAL '60 days'
  ) AS actividades_ultimos_60,
  (
    SELECT COUNT(*) FROM asistencias a JOIN participaciones p ON p.id = a.participacion_id
    WHERE p.voluntario_id = v.id AND a.hora_salida IS NOT NULL
      AND a.hora_salida < now() - INTERVAL '60 days' AND a.hora_salida >= now() - INTERVAL '120 days'
  ) AS actividades_previas_60_120,
  (
    SELECT COUNT(*) FROM asistencias a JOIN participaciones p ON p.id = a.participacion_id
    WHERE p.voluntario_id = v.id AND a.hora_salida IS NOT NULL
  ) AS actividades_completadas_total,
  e.porcentaje_avance,
  EXISTS (
    SELECT 1 FROM documentos d WHERE d.expediente_id = e.id AND d.vigencia_hasta IS NOT NULL AND d.vigencia_hasta < CURRENT_DATE
  ) AS tiene_documento_vencido
`;

const SQL_COMPONENTES_UNO = `
  SELECT v.id AS voluntario_id,
         TRIM(v.nombre || ' ' || COALESCE(v.apellido_paterno,'') || ' ' || COALESCE(v.apellido_materno,'')) AS nombre_completo,
         v.numero_voluntario AS folio,
         ${SUBCONSULTAS}
  FROM voluntarios v
  LEFT JOIN expedientes e ON e.voluntario_id = v.id
  WHERE v.id = $1
`;

const SQL_COMPONENTES_ASOCIACION = `
  SELECT v.id AS voluntario_id,
         TRIM(v.nombre || ' ' || COALESCE(v.apellido_paterno,'') || ' ' || COALESCE(v.apellido_materno,'')) AS nombre_completo,
         v.numero_voluntario AS folio,
         ${SUBCONSULTAS}
  FROM voluntarios v
  LEFT JOIN expedientes e ON e.voluntario_id = v.id
  WHERE v.asociacion_id = $1 AND v.activo = true
  ORDER BY v.nombre
`;

module.exports = RiesgoModel;
