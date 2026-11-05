const AuditoriaModel = require('../models/auditoriaModel');
const BitacoraModel = require('../models/bitacoraModel');

const METODOS_MUTAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Cualquier clave cuyo nombre sugiera un secreto se oculta (contraseñas,
// tokens, códigos 2FA, secretos TOTP, desafíos). Se evalúa por patrón en
// vez de una lista fija para no volver a dejar pasar campos nuevos.
//
// Además de secretos, se ocultan los datos personales sensibles (salud, identificación, domicilio,
// teléfonos, contacto de emergencia): la auditoría debe decir QUIÉN cambió QUÉ CAMPO, pero no puede
// convertirse en una segunda copia en claro de justo lo que se cifra en `voluntarios` — un respaldo o
// una consulta a esa tabla expondría todo y el cifrado de los campos no serviría de nada.
const PATRON_SENSIBLE = /pass|token|secre|codigo|desafio|clave|hash|authorization|cookie|sangre|alergia|discapacid|enfermedad|salud|curp|^ine$|ine_?tutor|domicilio|direccion|colonia|telefono|celular|nacimiento|emergencia/i;
const CAMPOS_SENSIBLES = { has: (clave) => PATRON_SENSIBLE.test(clave) };

const MAX_LONGITUD_TEXTO = 300;   // un texto más largo (p. ej. una imagen base64) se recorta
const MAX_ELEMENTOS = 20;         // arreglos más largos se recortan
const MAX_PROFUNDIDAD = 4;

/**
 * Prepara un valor para guardarlo en auditoría: oculta claves sensibles a CUALQUIER profundidad
 * (antes solo el primer nivel) y recorta textos, arreglos y anidamiento excesivos (antes se
 * guardaba el cuerpo completo: una firma en base64 o un texto de 100 000 caracteres engordaban la
 * tabla y cada respaldo).
 */
function sanitizarValor(valor, profundidad = 0) {
  if (typeof valor === 'string') {
    return valor.length > MAX_LONGITUD_TEXTO ? `${valor.slice(0, 120)}…[recortado, ${valor.length} caracteres]` : valor;
  }
  if (valor === null || typeof valor !== 'object') return valor;
  if (profundidad >= MAX_PROFUNDIDAD) return '[anidado, omitido]';
  if (Array.isArray(valor)) {
    const items = valor.slice(0, MAX_ELEMENTOS).map((v) => sanitizarValor(v, profundidad + 1));
    if (valor.length > MAX_ELEMENTOS) items.push(`…[${valor.length - MAX_ELEMENTOS} elementos más]`);
    return items;
  }
  const limpio = {};
  for (const [clave, v] of Object.entries(valor)) {
    limpio[clave] = CAMPOS_SENSIBLES.has(clave) ? '[oculto]' : sanitizarValor(v, profundidad + 1);
  }
  return limpio;
}

function sanitizarBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  return sanitizarValor(body);
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

module.exports = { sanitizarBody, registrarTrazabilidad };
