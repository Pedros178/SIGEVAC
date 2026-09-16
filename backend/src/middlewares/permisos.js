const UsuarioModel = require('../models/usuarioModel');

/**
 * Middleware factory: exige que el usuario autenticado tenga al menos
 * uno de los roles indicados.
 * Uso: router.get('/ruta', autenticar, requiereRol('super_admin','presidente'), handler)
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    const rolesUsuario = (req.usuario?.roles || []).map((r) => r.nombre || r);
    const tienePermiso = rolesUsuario.some((r) => rolesPermitidos.includes(r));
    if (!tienePermiso) {
      return res.status(403).json({ error: 'No tienes permisos suficientes para esta acción.' });
    }
    return next();
  };
}

/**
 * Middleware factory: exige que el usuario tenga un permiso específico
 * (clave granular, p.ej. 'voluntarios.crear'), calculado a partir de sus roles.
 * Requiere que `autenticar` haya corrido antes.
 */
function requierePermiso(claveRequerida) {
  return async (req, res, next) => {
    try {
      const permisos = await UsuarioModel.obtenerPermisos(req.usuario.id);
      if (!permisos.includes(claveRequerida)) {
        return res.status(403).json({ error: `Requiere el permiso: ${claveRequerida}` });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requiereRol, requierePermiso };
