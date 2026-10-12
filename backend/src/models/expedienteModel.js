const { query } = require('../config/database');

const ExpedienteModel = {
  /**
   * Crea el expediente vacío para un voluntario recién registrado y genera
   * automáticamente las filas de `documentos` según los tipos de documento
   * que apliquen (mayor/menor/ambos) — Módulo 7.
   */
  async crearParaVoluntario(voluntarioId, esMenorEdad, client) {
    const ejecutor = client || { query };
    const { rows: expedienteRows } = await ejecutor.query(
      `INSERT INTO expedientes (voluntario_id) VALUES ($1) RETURNING *`,
      [voluntarioId]
    );
    const expediente = expedienteRows[0];

    const aplicaA = esMenorEdad ? ['menor', 'ambos'] : ['mayor', 'ambos'];
    // Documentos requeridos (Módulo 3): rige el valor predeterminado de cada tipo
    // salvo que la asociación del voluntario lo haya personalizado en
    // `asociacion_config_documentos` (otro `aplica_a`, o no obligatorio = no se exige).
    const { rows: tiposDocumento } = await ejecutor.query(
      `SELECT td.id
       FROM tipos_documento td
       JOIN voluntarios v ON v.id = $1
       LEFT JOIN asociacion_config_documentos c
              ON c.tipo_documento_id = td.id AND c.asociacion_id = v.asociacion_id
       WHERE COALESCE(c.obligatorio, true) = true
         AND COALESCE(c.aplica_a, td.aplica_a) = ANY($2::text[])`,
      [voluntarioId, aplicaA]
    );

    for (const tipo of tiposDocumento) {
      await ejecutor.query(
        `INSERT INTO documentos (expediente_id, tipo_documento_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [expediente.id, tipo.id]
      );
    }

    return expediente;
  },

  async obtenerPorVoluntario(voluntarioId) {
    const { rows } = await query(`SELECT * FROM expedientes WHERE voluntario_id = $1`, [voluntarioId]);
    return rows[0] || null;
  },

  /**
   * Recalcula el semáforo (Módulo 9): completo / en_revision / incompleto,
   * y el porcentaje de avance, con base en el estado de sus documentos.
   */
  async recalcularEstado(expedienteId) {
    const { rows } = await query(
      `SELECT estado, COUNT(*)::int AS total FROM documentos WHERE expediente_id = $1 GROUP BY estado`,
      [expedienteId]
    );

    const conteos = { pendiente: 0, cargado: 0, aprobado: 0, rechazado: 0 };
    let total = 0;
    for (const fila of rows) {
      conteos[fila.estado] = fila.total;
      total += fila.total;
    }

    let estado = 'incompleto';
    let porcentaje = 0;
    if (total > 0) {
      porcentaje = Math.round((conteos.aprobado / total) * 100);
      if (conteos.aprobado === total) {
        estado = 'completo';
      } else if (conteos.cargado > 0 || conteos.aprobado > 0) {
        estado = 'en_revision';
      } else {
        estado = 'incompleto';
      }
    }

    const { rows: actualizado } = await query(
      `UPDATE expedientes SET estado = $2, porcentaje_avance = $3, actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [expedienteId, estado, porcentaje]
    );
    return actualizado[0];
  },
};

const DocumentoModel = {
  async listarPorExpediente(expedienteId) {
    const { rows } = await query(
      `SELECT d.*, td.clave AS tipo_clave, td.etiqueta AS tipo_etiqueta, td.tiene_vigencia,
              (SELECT COUNT(*)::int FROM archivos a WHERE a.documento_id = d.id) AS total_versiones,
              (SELECT a.id FROM archivos a WHERE a.documento_id = d.id ORDER BY a.version DESC LIMIT 1) AS ultimo_archivo_id,
              COALESCE((SELECT json_agg(json_build_object(
                'id', a.id, 'version', a.version, 'nombre_original', a.nombre_original,
                'mime_type', a.mime_type, 'tamano_bytes', a.tamano_bytes
              ) ORDER BY a.version DESC) FROM archivos a WHERE a.documento_id = d.id), '[]'::json) AS archivos
       FROM documentos d
       JOIN tipos_documento td ON td.id = d.tipo_documento_id
       WHERE d.expediente_id = $1
       ORDER BY td.etiqueta`,
      [expedienteId]
    );
    return rows;
  },

  async obtenerPorId(id) {
    const { rows } = await query(
      `SELECT d.*, td.clave AS tipo_clave, td.etiqueta AS tipo_etiqueta, td.tiene_vigencia
       FROM documentos d JOIN tipos_documento td ON td.id = d.tipo_documento_id
       WHERE d.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async actualizarEstado(id, { estado, observaciones, vigenciaHasta }) {
    const { rows } = await query(
      `UPDATE documentos
       SET estado = $2, observaciones = COALESCE($3, observaciones),
           vigencia_hasta = COALESCE($4, vigencia_hasta),
           -- Si se define/cambia la vigencia, se habilita de nuevo la alerta de
           -- vencimiento (por ejemplo, al renovar un seguro con nueva fecha).
           alerta_vigencia_enviada_en = CASE WHEN $4::date IS NOT NULL THEN NULL ELSE alerta_vigencia_enviada_en END,
           actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [id, estado, observaciones || null, vigenciaHasta || null]
    );
    return rows[0];
  },

  async marcarCargado(id) {
    const { rows } = await query(
      `UPDATE documentos SET estado = 'cargado', actualizado_en = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  /**
   * Módulo 17 (diferenciador — control de vigencia): documentos aprobados,
   * con vigencia definida, cuya fecha vence dentro de los próximos `dias`
   * (o ya vencieron) y a los que aún no se les ha enviado la alerta.
   */
  async listarProximosAVencer({ dias = 30, asociacionId = null } = {}) {
    const { rows } = await query(
      `SELECT d.*, td.etiqueta AS tipo_etiqueta,
              v.id AS voluntario_id, v.nombre AS voluntario_nombre, v.correo AS voluntario_correo,
              v.asociacion_id
       FROM documentos d
       JOIN tipos_documento td ON td.id = d.tipo_documento_id
       JOIN expedientes e ON e.id = d.expediente_id
       JOIN voluntarios v ON v.id = e.voluntario_id
       WHERE td.tiene_vigencia = true
         AND d.vigencia_hasta IS NOT NULL
         AND d.vigencia_hasta <= (CURRENT_DATE + ($1 || ' days')::interval)
         AND d.estado = 'aprobado'
         AND d.alerta_vigencia_enviada_en IS NULL
         AND ($2::uuid IS NULL OR v.asociacion_id = $2)
       ORDER BY d.vigencia_hasta ASC`,
      [dias, asociacionId]
    );
    return rows;
  },

  async marcarAlertaVigenciaEnviada(id) {
    await query(`UPDATE documentos SET alerta_vigencia_enviada_en = now() WHERE id = $1`, [id]);
  },
};

module.exports = { ExpedienteModel, DocumentoModel };
