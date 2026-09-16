/**
 * Refuerzo anti-CSRF para los únicos endpoints que se autentican con una
 * cookie enviada automáticamente por el navegador (`/auth/refresh` y
 * `/auth/logout` — ver utils/cookies.js). El resto de la API usa un
 * Authorization: Bearer <token> que un sitio atacante no puede adjuntar
 * por sí solo, así que no lo necesita.
 *
 * La cookie de refresh se configura con `SameSite=None` en producción
 * (necesario porque frontend y backend viven en subdominios distintos de
 * onrender.com — ver utils/cookies.js), lo que en principio permite que
 * un sitio de terceros dispare una petición a estos endpoints con la
 * cookie adjunta. Como defensa adicional, se exige que, cuando el
 * navegador envía el header `Origin` (lo hace en toda petición fetch/XHR
 * moderna), este coincida con el origen configurado del frontend.
 *
 * No se rechaza la petición cuando `Origin` está ausente: algunos
 * clientes legítimos no lo envían (llamadas directas a la API, ciertos
 * navegadores/configuraciones antiguas), y bloquearlos por completo
 * causaría más falsos positivos que el riesgo que mitiga. La cookie
 * `httpOnly` + el aislamiento de `path` ya limitan bastante el impacto;
 * esto es una capa adicional, no la única defensa.
 */
function verificarOrigen(req, res, next) {
  const origen = req.get('origin');
  if (!origen) return next();

  const origenesPermitidos = [process.env.FRONTEND_URL || 'http://localhost:5173'];
  if (origenesPermitidos.includes(origen)) return next();

  return res.status(403).json({ error: 'Origen no permitido.' });
}

module.exports = { verificarOrigen };
