const { query } = require('../config/database');

const ArchivoModel = {
  async crear({ documentoId, url, nombreOriginal, mimeType, tamanoBytes, subidoPor }) {
    const { rows: versionRows } = await query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS siguiente FROM archivos WHERE documento_id = $1`,
      [documentoId]
    );
    const version = versionRows[0].siguiente;

    let resultado;
    try {
      resultado = await query(
        `INSERT INTO archivos (documento_id, url, nombre_original, mime_type, tamano_bytes, version, subido_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [documentoId, url, nombreOriginal, mimeType, tamanoBytes, version, subidoPor || null]
      );
    } catch (err) {
      if (err.code !== '23505') throw err;
      const { rows } = await query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS siguiente FROM archivos WHERE documento_id = $1`,
        [documentoId]
      );
      resultado = await query(
        `INSERT INTO archivos (documento_id, url, nombre_original, mime_type, tamano_bytes, version, subido_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [documentoId, url, nombreOriginal, mimeType, tamanoBytes, rows[0].siguiente, subidoPor || null]
      );
    }
    return resultado.rows[0];
  },

  async listarPorDocumento(documentoId) {
    const { rows } = await query(
      `SELECT a.*, u.nombre AS subido_por_nombre
       FROM archivos a
       LEFT JOIN usuarios u ON u.id = a.subido_por
       WHERE a.documento_id = $1
       ORDER BY a.version DESC`,
      [documentoId]
    );
    return rows;
  },

  async obtenerUltimo(documentoId) {
    const { rows } = await query(
      `SELECT * FROM archivos WHERE documento_id = $1 ORDER BY version DESC LIMIT 1`,
      [documentoId]
    );
    return rows[0] || null;
  },

  async obtenerPorId(id) {
    const { rows } = await query(`SELECT * FROM archivos WHERE id = $1`, [id]);
    return rows[0] || null;
  },
};

module.exports = ArchivoModel;
