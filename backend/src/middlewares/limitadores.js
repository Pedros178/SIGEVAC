const rateLimit = require('express-rate-limit');

/**
 * Límites de peticiones por IP (memoria del proceso; con varias instancias cada una cuenta por separado).
 *
 *  - general: techo amplio para TODA la API. No frena el uso normal (un panel que se refresca cada
 *    minuto hace pocas decenas de peticiones por cuarto de hora), pero corta el barrido masivo,
 *    el scraping y los bucles descontrolados. Varias personas detrás de la misma red comparten IP,
 *    por eso el techo es holgado.
 *  - publico: endpoints SIN sesión (certificados por código, galería, estadísticas, actividades).
 *    Más estricto: son los que cualquiera en internet puede golpear.
 *
 * Configurables: GENERAL_RATE_LIMIT_MAX (por defecto 1500 / 15 min) y PUBLIC_RATE_LIMIT_MAX (300 / 15 min).
 */
function entero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

function crearLimitador({ max, windowMs = 15 * 60 * 1000, mensaje = 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' }) {
  return rateLimit({
    windowMs,
    max,
    message: { error: mensaje },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const limitadorGeneral = () => crearLimitador({ max: entero(process.env.GENERAL_RATE_LIMIT_MAX, 1500) });
const limitadorPublico = () => crearLimitador({ max: entero(process.env.PUBLIC_RATE_LIMIT_MAX, 300) });

module.exports = { crearLimitador, limitadorGeneral, limitadorPublico };
