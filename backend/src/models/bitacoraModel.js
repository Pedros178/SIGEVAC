const { query } = require('../config/database');

const BitacoraModel = {
  async crear({ usuarioId, evento, contexto }) {
    await query(
      `INSERT INTO bitacora (usuario_id, evento, contexto) VALUES ($1,$2,$3)`,
      [usuarioId || null, evento, contexto ? JSON.stringify(contexto) : null]
    );
  },

  /**
   * Lista la bitácora limitada a los usuarios de la asociación activa (antes
   * devolvía eventos de TODAS las asociaciones a cualquiera con permiso).
   */
  async listar({ asociacionId, usuarioId, evento, limit = 50, offset = 0 }) {
    const { rows } = await query(
      `SELECT b.* FROM bitacora b
       WHERE ($1::uuid IS NULL OR b.usuario_id IN (
               SELECT u.id FROM usuarios u
               WHERE u.asociacion_id = $1
                  OR EXISTS (SELECT 1 FROM usuario_asociaciones ua WHERE ua.usuario_id = u.id AND ua.asociacion_id = $1)))
         AND ($2::uuid IS NULL OR b.usuario_id = $2)
         AND ($3::text IS NULL OR b.evento = $3)
       ORDER BY b.creado_en DESC
       LIMIT $4 OFFSET $5`,
      [asociacionId || null, usuarioId || null, evento || null, limit, offset]
    );
    return rows;
  },
};

module.exports = BitacoraModel;
