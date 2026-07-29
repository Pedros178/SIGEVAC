const { query } = require('../config/database');

const UsuarioModel = {
  async crear({ nombre, correo, passwordHash, asociacionId }) {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, correo, password_hash, asociacion_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, asociacion_id, activo, creado_en`,
      [nombre, correo, passwordHash, asociacionId || null]
    );
    return rows[0];
  },

  async buscarPorCorreo(correo) {
    const { rows } = await query(
      `SELECT * FROM usuarios WHERE correo = $1`,
      [correo]
    );
    return rows[0] || null;
  },

  async buscarPorId(id) {
    const { rows } = await query(
      `SELECT id, nombre, correo, asociacion_id, activo, ultimo_login, creado_en
       FROM usuarios WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async listar({ asociacionId, limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT id, nombre, correo, asociacion_id, activo, ultimo_login, creado_en
       FROM usuarios
       WHERE ($1::uuid IS NULL OR asociacion_id = $1)
       ORDER BY creado_en DESC
       LIMIT $2 OFFSET $3`,
      [asociacionId || null, limit, offset]
    );
    return rows;
  },

  async obtenerRoles(usuarioId) {
    const { rows } = await query(
      `SELECT r.id, r.nombre
       FROM roles r
       JOIN usuarios_roles ur ON ur.rol_id = r.id
       WHERE ur.usuario_id = $1`,
      [usuarioId]
    );
    return rows;
  },

  async obtenerPermisos(usuarioId) {
    const { rows } = await query(
      `SELECT DISTINCT p.clave
       FROM permisos p
       JOIN roles_permisos rp ON rp.permiso_id = p.id
       JOIN usuarios_roles ur ON ur.rol_id = rp.rol_id
       WHERE ur.usuario_id = $1`,
      [usuarioId]
    );
    return rows.map((r) => r.clave);
  },

  async asignarRol(usuarioId, rolId) {
    await query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [usuarioId, rolId]
    );
  },

  async actualizarPassword(usuarioId, passwordHash) {
    await query(
      `UPDATE usuarios SET password_hash = $1, actualizado_en = now() WHERE id = $2`,
      [passwordHash, usuarioId]
    );
  },

  async registrarLoginExitoso(usuarioId) {
    await query(
      `UPDATE usuarios
       SET ultimo_login = now(), intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE id = $1`,
      [usuarioId]
    );
  },

  async registrarIntentoFallido(usuarioId, maxIntentos, minutosBloqueo) {
    const { rows } = await query(
      `UPDATE usuarios
       SET intentos_fallidos = intentos_fallidos + 1,
           bloqueado_hasta = CASE
             WHEN intentos_fallidos + 1 >= $2
             THEN now() + ($3 || ' minutes')::interval
             ELSE bloqueado_hasta
           END
       WHERE id = $1
       RETURNING intentos_fallidos, bloqueado_hasta`,
      [usuarioId, maxIntentos, minutosBloqueo]
    );
    return rows[0];
  },

  async actualizar(usuarioId, { nombre, activo }) {
    const { rows } = await query(
      `UPDATE usuarios
       SET nombre = COALESCE($2, nombre),
           activo = COALESCE($3, activo),
           actualizado_en = now()
       WHERE id = $1
       RETURNING id, nombre, correo, activo`,
      [usuarioId, nombre ?? null, activo ?? null]
    );
    return rows[0];
  },
};

module.exports = UsuarioModel;
