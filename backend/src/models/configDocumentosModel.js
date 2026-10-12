const { query } = require('../config/database');

/**
 * Documentos requeridos por asociación (Módulo 3, tabla `asociacion_config_documentos`).
 *
 * `tipos_documento` trae los valores predeterminados globales. Cada asociación
 * puede sobrescribir, por tipo de documento, dos cosas: a quién se le exige
 * (`aplica_a`: mayor | menor | ambos) y si lo exige (`obligatorio`). Sin fila
 * propia, rige el valor predeterminado del tipo.
 */
const ConfigDocumentosModel = {
  /** Lista todos los tipos con su valor efectivo para la asociación. */
  async listarEfectivo(asociacionId) {
    const { rows } = await query(
      `SELECT td.id AS tipo_documento_id, td.clave, td.etiqueta, td.tiene_vigencia,
              td.aplica_a AS aplica_a_predeterminado,
              COALESCE(c.aplica_a, td.aplica_a) AS aplica_a,
              COALESCE(c.obligatorio, true) AS obligatorio,
              (c.id IS NOT NULL) AS personalizado
       FROM tipos_documento td
       LEFT JOIN asociacion_config_documentos c
              ON c.tipo_documento_id = td.id AND c.asociacion_id = $1
       ORDER BY td.etiqueta`,
      [asociacionId]
    );
    return rows;
  },

  async establecer(asociacionId, tipoDocumentoId, { obligatorio, aplicaA }) {
    const { rows } = await query(
      `INSERT INTO asociacion_config_documentos (asociacion_id, tipo_documento_id, obligatorio, aplica_a)
       SELECT $1, td.id, COALESCE($3::boolean, true), COALESCE($4::text, td.aplica_a)
       FROM tipos_documento td WHERE td.id = $2
       ON CONFLICT (asociacion_id, tipo_documento_id) DO UPDATE
         SET obligatorio = COALESCE($3::boolean, asociacion_config_documentos.obligatorio),
             aplica_a = COALESCE($4::text, asociacion_config_documentos.aplica_a)
       RETURNING tipo_documento_id, obligatorio, aplica_a`,
      [asociacionId, tipoDocumentoId, obligatorio ?? null, aplicaA ?? null]
    );
    return rows[0] || null;
  },

  /** Vuelve al valor predeterminado del tipo (borra la personalización). */
  async restablecer(asociacionId, tipoDocumentoId) {
    const { rowCount } = await query(
      `DELETE FROM asociacion_config_documentos WHERE asociacion_id = $1 AND tipo_documento_id = $2`,
      [asociacionId, tipoDocumentoId]
    );
    return rowCount > 0;
  },
};

module.exports = ConfigDocumentosModel;
