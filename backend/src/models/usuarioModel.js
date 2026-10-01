const { query } = require('../config/database');
const { cifrar, descifrar } = require('../utils/cifrado');

const UsuarioModel = {
  async crear({ nombre, correo, passwordHash, asociacionId }) {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, correo, password_hash, asociacion_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, asociacion_id, activo, creado_en`,
      [nombre, correo, passwordHash, asociacionId || null]
    );
    const usuario = rows[0];
    // Multi-asociación: la asociación con la que se crea el usuario queda
    // registrada de una vez como su asociación predeterminada.
    if (asociacionId) {
      await UsuarioModel.asignarAsociacion(usuario.id, asociacionId, true);
    }
    return usuario;
  },

  async buscarPorCorreo(correo) {
    const { rows } = await query(
      `SELECT * FROM usuarios WHERE correo = $1`,
      [correo]
    );
    return rows[0] || null;
  },

  async buscarSeguridadPorId(id) {
    const { rows } = await query(
      `SELECT id, nombre, correo, password_hash, activo, two_factor_secret, two_factor_activo,
              two_factor_ultimo_paso, intentos_fallidos, bloqueado_hasta
       FROM usuarios WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    return { ...rows[0], two_factor_secret: descifrar(rows[0].two_factor_secret) };
  },

  async buscarPorId(id) {
    const { rows } = await query(
      `SELECT id, nombre, correo, asociacion_id, activo, ultimo_login, creado_en, two_factor_activo
       FROM usuarios WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async listar({ asociacionId, limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT id, nombre, correo, asociacion_id, activo, ultimo_login, creado_en
       FROM usuarios
       WHERE ($1::uuid IS NULL OR asociacion_id = $1
              OR EXISTS (SELECT 1 FROM usuario_asociaciones ua WHERE ua.usuario_id = usuarios.id AND ua.asociacion_id = $1))
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

  async guardarConfiguracion2FA(usuarioId, secreto, activo) {
    const { rows } = await query(
      `UPDATE usuarios SET two_factor_secret = $2, two_factor_activo = $3,
              two_factor_ultimo_paso = NULL, actualizado_en = now()
       WHERE id = $1 RETURNING id, two_factor_activo`,
      [usuarioId, secreto ? cifrar(secreto) : null, activo]
    );
    return rows[0];
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

  /** Registra un código TOTP usado; false si ese paso (o uno posterior) ya se consumió (replay). */
  async consumirPasoTotp(usuarioId, paso) {
    const { rowCount } = await query(
      `UPDATE usuarios SET two_factor_ultimo_paso = $2
       WHERE id = $1 AND (two_factor_ultimo_paso IS NULL OR two_factor_ultimo_paso < $2)`,
      [usuarioId, paso]
    );
    return rowCount === 1;
  },

  /** true si el usuario pertenece a la asociación (N:M o columna heredada). */
  async estaEnAsociacion(usuarioId, asociacionId) {
    if (!asociacionId) return false;
    const { rows } = await query(
      `SELECT 1 FROM usuarios u
       WHERE u.id = $1 AND (u.asociacion_id = $2
         OR EXISTS (SELECT 1 FROM usuario_asociaciones ua WHERE ua.usuario_id = u.id AND ua.asociacion_id = $2))`,
      [usuarioId, asociacionId]
    );
    return rows.length > 0;
  },

  async esSuperAdmin(usuarioId) {
    const { rows } = await query(
      `SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = $1 AND r.nombre = 'super_admin'`,
      [usuarioId]
    );
    return rows.length > 0;
  },

  async contarSuperAdminsActivos() {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id JOIN roles r ON r.id = ur.rol_id
       WHERE r.nombre = 'super_admin' AND u.activo = true`
    );
    return rows[0].total;
  },

  /** Estado vigente (activo, roles, pertenencia) que se revalida en CADA petición autenticada. */
  async estadoDeSesion(usuarioId, asociacionId) {
    const { rows } = await query(
      `SELECT u.activo,
              COALESCE((SELECT json_agg(json_build_object('id', r.id, 'nombre', r.nombre))
                        FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
                        WHERE ur.usuario_id = u.id), '[]'::json) AS roles,
              ($2::uuid IS NULL OR u.asociacion_id = $2
                OR EXISTS (SELECT 1 FROM usuario_asociaciones ua
                           WHERE ua.usuario_id = u.id AND ua.asociacion_id = $2)) AS pertenece
       FROM usuarios u WHERE u.id = $1`,
      [usuarioId, asociacionId || null]
    );
    return rows[0] || null;
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

  // ---------------------------------------------------------------
  // Multi-asociación (usuario_asociaciones, N:M)
  // ---------------------------------------------------------------

  /** Lista las asociaciones a las que pertenece un usuario. */
  async obtenerAsociaciones(usuarioId) {
    const { rows } = await query(
      `SELECT a.id, a.nombre, ua.es_predeterminada
       FROM usuario_asociaciones ua
       JOIN asociaciones a ON a.id = ua.asociacion_id
       WHERE ua.usuario_id = $1
       ORDER BY ua.es_predeterminada DESC, a.nombre ASC`,
      [usuarioId]
    );
    return rows;
  },

  /**
   * Asociación "activa" con la que debe iniciar sesión un usuario:
   * su predeterminada si tiene varias, o la única que tenga. Si el
   * usuario todavía no tiene filas en usuario_asociaciones (por ejemplo,
   * datos creados antes de esta funcionalidad), recurre a la columna
   * heredada `usuarios.asociacion_id` como respaldo.
   */
  async obtenerAsociacionPredeterminada(usuarioId) {
    const { rows } = await query(
      `SELECT a.id, a.nombre
       FROM usuario_asociaciones ua
       JOIN asociaciones a ON a.id = ua.asociacion_id
       WHERE ua.usuario_id = $1
       ORDER BY ua.es_predeterminada DESC, ua.creado_en ASC
       LIMIT 1`,
      [usuarioId]
    );
    if (rows[0]) return rows[0];

    const { rows: legado } = await query(
      `SELECT a.id, a.nombre FROM usuarios u JOIN asociaciones a ON a.id = u.asociacion_id WHERE u.id = $1`,
      [usuarioId]
    );
    return legado[0] || null;
  },

  /** true si el usuario pertenece a la asociación indicada. */
  async perteneceAAsociacion(usuarioId, asociacionId) {
    const { rows } = await query(
      `SELECT 1 FROM usuario_asociaciones WHERE usuario_id = $1 AND asociacion_id = $2`,
      [usuarioId, asociacionId]
    );
    return rows.length > 0;
  },

  /**
   * Da de alta (o confirma) la pertenencia de un usuario a una asociación.
   * Si esPredeterminada = true, se desmarca cualquier otra predeterminada
   * previa del mismo usuario (solo puede haber una).
   */
  async asignarAsociacion(usuarioId, asociacionId, esPredeterminada = false) {
    if (esPredeterminada) {
      await query(`UPDATE usuario_asociaciones SET es_predeterminada = false WHERE usuario_id = $1`, [usuarioId]);
    }
    const { rows } = await query(
      `INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, asociacion_id)
       DO UPDATE SET es_predeterminada = EXCLUDED.es_predeterminada
       RETURNING usuario_id, asociacion_id, es_predeterminada`,
      [usuarioId, asociacionId, !!esPredeterminada]
    );
    return rows[0];
  },

  /**
   * Quita a un usuario de una asociación. No permite dejarlo sin ninguna
   * (todo usuario del sistema debe pertenecer al menos a una asociación).
   */
  async quitarAsociacion(usuarioId, asociacionId) {
    const actuales = await UsuarioModel.obtenerAsociaciones(usuarioId);
    if (actuales.length <= 1) {
      const error = new Error('Un usuario debe pertenecer al menos a una asociación.');
      error.status = 400;
      throw error;
    }
    await query(
      `DELETE FROM usuario_asociaciones WHERE usuario_id = $1 AND asociacion_id = $2`,
      [usuarioId, asociacionId]
    );
    // Si se quitó la que era predeterminada, se promueve otra automáticamente.
    const quedan = await UsuarioModel.obtenerAsociaciones(usuarioId);
    if (quedan.length > 0 && !quedan.some((a) => a.es_predeterminada)) {
      await UsuarioModel.asignarAsociacion(usuarioId, quedan[0].id, true);
    }
  },
};

module.exports = UsuarioModel;
