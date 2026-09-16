const { query } = require('../config/database');

const GaleriaModel = {
  /**
   * Todas las fotos de la asociación (publicadas y ocultas), para el panel
   * de Administración. Ordenadas por `orden` y luego por fecha de subida.
   */
  async listar(asociacionId) {
    const { rows } = await query(
      `SELECT g.*, u.correo AS subida_por_correo
       FROM galeria_publica g
       LEFT JOIN usuarios u ON u.id = g.subida_por
       WHERE g.asociacion_id = $1
       ORDER BY g.orden ASC, g.creado_en ASC`,
      [asociacionId]
    );
    return rows;
  },

  /**
   * Solo las publicadas y vigentes, para la sección "Galería" del Home
   * público (sin autenticación, así que nunca debe incluir las ocultas).
   * Un cartel con `vigente_hasta` en el pasado se excluye solo, sin que
   * nadie tenga que acordarse de ocultarlo a mano.
   */
  async listarPublica(asociacionId) {
    const { rows } = await query(
      `SELECT id, texto_alternativo, leyenda, orden, vigente_hasta
       FROM galeria_publica
       WHERE asociacion_id = $1
         AND publicada = true
         AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
       ORDER BY orden ASC, creado_en ASC`,
      [asociacionId]
    );
    return rows;
  },

  async obtenerPorId(id, asociacionId) {
    const { rows } = await query(
      `SELECT * FROM galeria_publica WHERE id = $1 AND asociacion_id = $2`,
      [id, asociacionId]
    );
    return rows[0] || null;
  },

  async crear({
    asociacionId, url, mimeType, textoAlternativo, leyenda, orden, subidaPor, vigenteHasta,
  }) {
    let ordenFinal = orden;
    if (ordenFinal === undefined || ordenFinal === null) {
      const { rows } = await query(
        `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM galeria_publica WHERE asociacion_id = $1`,
        [asociacionId]
      );
      ordenFinal = rows[0].siguiente;
    }
    const { rows } = await query(
      `INSERT INTO galeria_publica (asociacion_id, url, mime_type, texto_alternativo, leyenda, orden, subida_por, vigente_hasta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [asociacionId, url, mimeType || 'image/jpeg', textoAlternativo, leyenda, ordenFinal, subidaPor || null, vigenteHasta || null]
    );
    return rows[0];
  },

  async actualizar(id, asociacionId, datos) {
    const campos = [];
    const valores = [];
    let i = 1;

    if (datos.textoAlternativo !== undefined) { campos.push(`texto_alternativo = $${i++}`); valores.push(datos.textoAlternativo); }
    if (datos.leyenda !== undefined) { campos.push(`leyenda = $${i++}`); valores.push(datos.leyenda); }
    if (datos.orden !== undefined) { campos.push(`orden = $${i++}`); valores.push(datos.orden); }
    if (datos.publicada !== undefined) { campos.push(`publicada = $${i++}`); valores.push(datos.publicada); }
    // vigenteHasta acepta explícitamente `null` para poder quitarle la
    // vigencia a un cartel (que vuelva a mostrarse sin fecha de cierre).
    if (datos.vigenteHasta !== undefined) { campos.push(`vigente_hasta = $${i++}`); valores.push(datos.vigenteHasta); }

    if (campos.length === 0) return this.obtenerPorId(id, asociacionId);

    valores.push(id, asociacionId);
    const { rows } = await query(
      `UPDATE galeria_publica SET ${campos.join(', ')} WHERE id = $${i++} AND asociacion_id = $${i} RETURNING *`,
      valores
    );
    return rows[0] || null;
  },

  async eliminar(id, asociacionId) {
    const { rows } = await query(
      `DELETE FROM galeria_publica WHERE id = $1 AND asociacion_id = $2 RETURNING *`,
      [id, asociacionId]
    );
    return rows[0] || null;
  },
};

module.exports = GaleriaModel;
