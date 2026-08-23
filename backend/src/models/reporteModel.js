const { query } = require('../config/database');

const NOMBRE_COMPLETO = `TRIM(v.nombre || ' ' || COALESCE(v.apellido_paterno,'') || ' ' || COALESCE(v.apellido_materno,''))`;

const ReporteModel = {
  async voluntariosActivos(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre, v.curp,
              CASE WHEN v.es_menor_edad THEN 'Menor de edad' ELSE 'Mayor de edad' END AS clasificacion_edad,
              v.telefono, v.correo, to_char(v.creado_en, 'YYYY-MM-DD') AS fecha_registro
       FROM voluntarios v WHERE v.asociacion_id = $1 AND v.activo = true ORDER BY v.creado_en DESC`,
      [asociacionId]
    );
    return {
      titulo: 'Voluntarios activos',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' }, { key: 'curp', label: 'CURP' },
        { key: 'clasificacion_edad', label: 'Edad' }, { key: 'telefono', label: 'Teléfono' },
        { key: 'correo', label: 'Correo' }, { key: 'fecha_registro', label: 'Registrado' },
      ],
      filas: rows,
    };
  },

  async voluntariosInactivos(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre, v.curp, to_char(v.actualizado_en, 'YYYY-MM-DD') AS fecha_baja
       FROM voluntarios v WHERE v.asociacion_id = $1 AND v.activo = false ORDER BY v.actualizado_en DESC`,
      [asociacionId]
    );
    return {
      titulo: 'Voluntarios inactivos',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' },
        { key: 'curp', label: 'CURP' }, { key: 'fecha_baja', label: 'Última actualización' },
      ],
      filas: rows,
    };
  },

  async expedientesCompletos(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre,
              e.porcentaje_avance AS avance, to_char(e.actualizado_en, 'YYYY-MM-DD') AS fecha_completado
       FROM expedientes e JOIN voluntarios v ON v.id = e.voluntario_id
       WHERE v.asociacion_id = $1 AND e.estado = 'completo' ORDER BY e.actualizado_en DESC`,
      [asociacionId]
    );
    return {
      titulo: 'Expedientes completos',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' },
        { key: 'avance', label: 'Avance %' }, { key: 'fecha_completado', label: 'Completado el' },
      ],
      filas: rows,
    };
  },

  async expedientesPendientes(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre,
              e.estado, e.porcentaje_avance AS avance,
              (SELECT COUNT(*) FROM documentos d WHERE d.expediente_id = e.id AND d.estado = 'pendiente') AS documentos_faltantes
       FROM expedientes e JOIN voluntarios v ON v.id = e.voluntario_id
       WHERE v.asociacion_id = $1 AND e.estado != 'completo' ORDER BY e.porcentaje_avance ASC`,
      [asociacionId]
    );
    return {
      titulo: 'Expedientes pendientes',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' }, { key: 'estado', label: 'Estado' },
        { key: 'avance', label: 'Avance %' }, { key: 'documentos_faltantes', label: 'Docs. faltantes' },
      ],
      filas: rows,
    };
  },

  async horasAcumuladas(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre,
              hs.tipo, hs.periodo, hs.horas_acumuladas AS horas
       FROM horas_servicio hs JOIN voluntarios v ON v.id = hs.voluntario_id
       WHERE v.asociacion_id = $1 ORDER BY hs.periodo DESC, nombre`,
      [asociacionId]
    );
    return {
      titulo: 'Horas de servicio acumuladas',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' }, { key: 'tipo', label: 'Tipo' },
        { key: 'periodo', label: 'Periodo' }, { key: 'horas', label: 'Horas' },
      ],
      filas: rows,
    };
  },

  async participacionPorActividad(asociacionId) {
    const { rows } = await query(
      `SELECT a.nombre AS actividad, to_char(a.fecha, 'YYYY-MM-DD') AS fecha, a.lugar,
              COUNT(p.id)::int AS inscritos,
              COUNT(asi.hora_salida)::int AS asistencias_completadas,
              COALESCE(SUM(asi.horas_realizadas), 0)::float AS horas_totales
       FROM actividades a
       LEFT JOIN participaciones p ON p.actividad_id = a.id
       LEFT JOIN asistencias asi ON asi.participacion_id = p.id
       WHERE a.asociacion_id = $1
       GROUP BY a.id ORDER BY a.fecha DESC`,
      [asociacionId]
    );
    return {
      titulo: 'Participación por actividad',
      columnas: [
        { key: 'actividad', label: 'Actividad' }, { key: 'fecha', label: 'Fecha' }, { key: 'lugar', label: 'Lugar' },
        { key: 'inscritos', label: 'Inscritos' }, { key: 'asistencias_completadas', label: 'Asistencias' },
        { key: 'horas_totales', label: 'Horas totales' },
      ],
      filas: rows,
    };
  },

  async documentosFaltantes(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre, td.etiqueta AS documento
       FROM documentos d
       JOIN tipos_documento td ON td.id = d.tipo_documento_id
       JOIN expedientes e ON e.id = d.expediente_id
       JOIN voluntarios v ON v.id = e.voluntario_id
       WHERE v.asociacion_id = $1 AND d.estado = 'pendiente'
       ORDER BY nombre, documento`,
      [asociacionId]
    );
    return {
      titulo: 'Documentos faltantes',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' }, { key: 'documento', label: 'Documento pendiente' },
      ],
      filas: rows,
    };
  },

  async voluntariosPorMunicipio(asociacionId) {
    const { rows } = await query(
      `SELECT COALESCE(m.nombre, 'Sin especificar') AS municipio, COUNT(v.id)::int AS total
       FROM voluntarios v LEFT JOIN municipios m ON m.id = v.municipio_id
       WHERE v.asociacion_id = $1 GROUP BY m.nombre ORDER BY total DESC`,
      [asociacionId]
    );
    return {
      titulo: 'Voluntarios por municipio',
      columnas: [{ key: 'municipio', label: 'Municipio' }, { key: 'total', label: 'Total' }],
      filas: rows,
    };
  },

  async menores(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre, to_char(v.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
              t.nombre AS tutor, t.telefono AS telefono_tutor
       FROM voluntarios v LEFT JOIN tutores t ON t.voluntario_id = v.id
       WHERE v.asociacion_id = $1 AND v.es_menor_edad = true ORDER BY nombre`,
      [asociacionId]
    );
    return {
      titulo: 'Voluntarios menores de edad',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' },
        { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
        { key: 'tutor', label: 'Tutor' }, { key: 'telefono_tutor', label: 'Teléfono del tutor' },
      ],
      filas: rows,
    };
  },

  async mayores(asociacionId) {
    const { rows } = await query(
      `SELECT v.numero_voluntario AS folio, ${NOMBRE_COMPLETO} AS nombre, to_char(v.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, v.telefono, v.correo
       FROM voluntarios v WHERE v.asociacion_id = $1 AND v.es_menor_edad = false ORDER BY nombre`,
      [asociacionId]
    );
    return {
      titulo: 'Voluntarios mayores de edad',
      columnas: [
        { key: 'folio', label: 'Folio' }, { key: 'nombre', label: 'Nombre' },
        { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
        { key: 'telefono', label: 'Teléfono' }, { key: 'correo', label: 'Correo' },
      ],
      filas: rows,
    };
  },
};

module.exports = ReporteModel;
