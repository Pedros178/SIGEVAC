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
    const { rows: tiposDocumento } = await ejecutor.query(
      `SELECT id FROM tipos_documento WHERE aplica_a = ANY($1::text[])`,
      [aplicaA]
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
              (SELECT COUNT(*)::int FROM archivos a WHERE a.documento_id = d.id) AS total_versiones
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
           vigencia_hasta = COALESCE($4, vigencia_hasta), actualizado_en = now()
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
};

module.exports = { ExpedienteModel, DocumentoModel };
