const AuditoriaModel = require('../models/auditoriaModel');
const BitacoraModel = require('../models/bitacoraModel');

const METODOS_MUTAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CAMPOS_SENSIBLES = new Set(['password', 'password_hash', 'refresh_token', 'token', 'nueva_password']);

function sanitizarBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  const limpio = {};
  for (const [clave, valor] of Object.entries(body)) {
    limpio[clave] = CAMPOS_SENSIBLES.has(clave) ? '[oculto]' : valor;
  }
  return limpio;
}

/**
 * Debe montarse DESPUÉS de `autenticar`. No bloquea ni retrasa la respuesta:
 * el registro ocurre en el evento 'finish' de la respuesta, de forma
 * best-effort (los errores de registro nunca deben romper la petición real).
 */
function registrarTrazabilidad(req, res, next) {
  const inicio = Date.now();

  res.on('finish', () => {
    if (!req.usuario) return; // no se traza tráfico no autenticado (login, etc. ya tienen su propio rate limit)

    const segmentos = req.originalUrl.split('?')[0].split('/').filter(Boolean); // ['api','voluntarios', ...]
    const moduloAfectado = segmentos[1] || 'desconocido';
    const duracionMs = Date.now() - inicio;

    // Bitácora: toda petición autenticada, exitosa o no (Módulo 21)
    BitacoraModel.crear({
      usuarioId: req.usuario.id,
      evento: `${req.method} ${req.originalUrl}`,
      contexto: { status: res.statusCode, duracion_ms: duracionMs },
    }).catch((err) => console.error('No se pudo registrar en bitácora:', err.message));

    // Auditoría: solo operaciones que modifican datos y que tuvieron éxito (Módulo 18)
    if (METODOS_MUTAN.has(req.method) && res.statusCode < 400) {
      AuditoriaModel.crear({
        usuarioId: req.usuario.id,
        accion: `${req.method} ${req.originalUrl.split('?')[0]}`,
        moduloAfectado,
        entidadId: req.params?.id || req.params?.voluntarioId || req.params?.documentoId || null,
        detalle: sanitizarBody(req.body),
        ip: req.ip,
      }).catch((err) => console.error('No se pudo registrar en auditoría:', err.message));
    }
  });

  next();
}

module.exports = { registrarTrazabilidad };
