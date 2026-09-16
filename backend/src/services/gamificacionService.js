const InsigniaModel = require('../models/insigniaModel');

/**
 * Evalúa el progreso de un voluntario contra el catálogo completo de
 * insignias y otorga las que cumpla y aún no tenga. Es "best-effort":
 * nunca lanza hacia el llamador, para no interrumpir el flujo principal
 * (p.ej. registrar la salida de una actividad) si algo falla aquí,
 * siguiendo el mismo patrón que el resto de los servicios del proyecto
 * (ver notificacionService.js).
 *
 * @returns {Promise<Array>} insignias recién otorgadas en esta evaluación
 */
async function evaluarInsignias(voluntarioId) {
  try {
    const [catalogo, metricas, yaObtenidas] = await Promise.all([
      InsigniaModel.listarCatalogo(),
      InsigniaModel.obtenerMetricas(voluntarioId),
      InsigniaModel.clavesObtenidas(voluntarioId),
    ]);

    const nuevas = [];
    for (const insignia of catalogo) {
      if (yaObtenidas.has(insignia.clave)) continue;
      if (!cumpleCriterio(insignia, metricas)) continue;

      const otorgada = await InsigniaModel.otorgar(voluntarioId, insignia.id);
      if (otorgada) nuevas.push(insignia);
    }
    return nuevas;
  } catch (err) {
    console.error('No se pudo evaluar la gamificación del voluntario:', err.message);
    return [];
  }
}

function cumpleCriterio(insignia, metricas) {
  const valorActual = metricas[insignia.criterio_tipo];
  if (valorActual === undefined) return false;
  return valorActual >= Number(insignia.criterio_valor);
}

const NIVELES = [
  { clave: 'bronce', etiqueta: 'Bronce', minimo: 0 },
  { clave: 'plata', etiqueta: 'Plata', minimo: 20 },
  { clave: 'oro', etiqueta: 'Oro', minimo: 50 },
  { clave: 'platino', etiqueta: 'Platino', minimo: 100 },
];

/**
 * Deriva el nivel del voluntario a partir de sus horas totales, sin
 * necesidad de almacenarlo (siempre se calcula sobre datos reales).
 */
function calcularNivel(horasTotales) {
  const horas = Number(horasTotales) || 0;
  let actual = NIVELES[0];
  for (const nivel of NIVELES) {
    if (horas >= nivel.minimo) actual = nivel;
  }
  const siguiente = NIVELES.find((n) => n.minimo > actual.minimo) || null;
  return {
    clave: actual.clave,
    etiqueta: actual.etiqueta,
    horas_totales: horas,
    siguiente_nivel: siguiente ? { etiqueta: siguiente.etiqueta, horas_faltantes: Number((siguiente.minimo - horas).toFixed(2)) } : null,
  };
}

module.exports = { evaluarInsignias, calcularNivel, NIVELES };
