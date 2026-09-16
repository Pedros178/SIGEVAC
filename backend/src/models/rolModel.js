const { query } = require('../config/database');

const RolModel = {
  async listar() {
    const { rows } = await query(`SELECT id, nombre, descripcion FROM roles ORDER BY nombre`);
    return rows;
  },

  async buscarPorNombre(nombre) {
    const { rows } = await query(`SELECT * FROM roles WHERE nombre = $1`, [nombre]);
    return rows[0] || null;
  },

  async buscarPorId(id) {
    const { rows } = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async crear({ nombre, descripcion }) {
    const { rows } = await query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2)
       RETURNING id, nombre, descripcion`,
      [nombre, descripcion || null]
    );
    return rows[0];
  },

  async listarPermisos() {
    const { rows } = await query(`SELECT id, clave, modulo, descripcion FROM permisos ORDER BY modulo, clave`);
    return rows;
  },

  async obtenerPermisos(rolId) {
    const { rows } = await query(
      `SELECT p.id, p.clave, p.modulo, p.descripcion
       FROM permisos p JOIN roles_permisos rp ON rp.permiso_id = p.id
       WHERE rp.rol_id = $1 ORDER BY p.modulo, p.clave`,
      [rolId]
    );
    return rows;
  },

  async reemplazarPermisos(rolId, permisosIds) {
    const client = await require('../config/database').getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM roles_permisos WHERE rol_id = $1', [rolId]);
      if (permisosIds.length) {
        await client.query(
          `INSERT INTO roles_permisos (rol_id, permiso_id)
           SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
          [rolId, permisosIds]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
};

module.exports = RolModel;
