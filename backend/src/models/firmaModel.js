const { query } = require('../config/database');

const FirmaModel = {
  async crear({ documentoId, firmanteNombre, firmanteTipo, imagenPngBase64, ip, userAgent }) {
    const { rows } = await query(
      `INSERT INTO firmas (documento_id, firmante_nombre, firmante_tipo, imagen_png_base64, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, documento_id, firmante_nombre, firmante_tipo, creado_en`,
      [documentoId, firmanteNombre, firmanteTipo || 'voluntario', imagenPngBase64, ip || null, userAgent || null]
    );
    return rows[0];
  },

  async obtenerPorDocumento(documentoId) {
    const { rows } = await query(
      `SELECT id, documento_id, firmante_nombre, firmante_tipo, imagen_png_base64, creado_en
       FROM firmas WHERE documento_id = $1 ORDER BY creado_en DESC LIMIT 1`,
      [documentoId]
    );
    return rows[0] || null;
  },
};

module.exports = FirmaModel;
