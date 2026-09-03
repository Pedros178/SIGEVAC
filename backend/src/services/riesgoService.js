/**
 * Modelo de riesgo de abandono de voluntarios.
 *
 * DECISIÓN DE DISEÑO (documentada a propósito para la defensa de tesis):
 * se implementa como un modelo de SCORING POR REGLAS PONDERADAS, explicable
 * criterio por criterio — no como un modelo de machine learning entrenado.
 * Con los datos de una sola asociación (decenas o cientos de voluntarios,
 * no miles), entrenar un modelo de ML real tendría alto riesgo de
 * sobreajuste y sus resultados serían difíciles de justificar ante un
 * jurado o ante el propio usuario del sistema. Un modelo de reglas con
 * pesos fijos y desglose transparente es más honesto, más fácil de
 * auditar, y le permite a la asociación entender exactamente POR QUÉ un
 * voluntario aparece en riesgo — algo que un modelo de caja negra no
 * ofrecería con esta cantidad de datos.
 *
 * Cada criterio suma "puntos de riesgo" (0-100). El puntaje final se
 * clasifica en tres niveles.
 */

const NIVELES_RIESGO = [
  { clave: 'bajo', etiqueta: 'Bajo', maximo: 24 },
  { clave: 'medio', etiqueta: 'Medio', maximo: 49 },
  { clave: 'alto', etiqueta: 'Alto', maximo: Infinity },
];

/**
 * @param {object} componentes
 * @param {number|null} componentes.diasDesdeUltimaActividad — null si nunca ha completado una actividad
 * @param {number} componentes.antiguedadDias
 * @param {number} componentes.actividadesUltimos60Dias
 * @param {number} componentes.actividadesPrevias60a120Dias
 * @param {number} componentes.actividadesCompletadasTotal
 * @param {number} componentes.porcentajeAvanceExpediente 0-100
 * @param {boolean} componentes.tieneDocumentoVencido
 */
function calcularRiesgo(componentes) {
  const desglose = [];

  // A) Inactividad reciente (peso máximo: es la señal más directa de
  // abandono). Si nunca ha completado una actividad, se mide desde su
  // fecha de ingreso en vez de "nunca", para no dejarlo fuera del cálculo.
  const diasInactivo = componentes.diasDesdeUltimaActividad ?? componentes.antiguedadDias;
  const puntosInactividad = puntosPorInactividad(diasInactivo);
  desglose.push({
    criterio: 'inactividad_reciente',
    etiqueta: componentes.diasDesdeUltimaActividad == null
      ? `Nunca ha completado una actividad (${diasInactivo} días desde su ingreso)`
      : `${diasInactivo} días desde su última actividad completada`,
    puntos: puntosInactividad,
  });

  // B) Tendencia de participación: solo se evalúa con al menos 60 días de
  // antigüedad, porque con menos historial la comparación no es confiable.
  let puntosTendencia = 0;
  if (componentes.antiguedadDias >= 60) {
    const recientes = componentes.actividadesUltimos60Dias;
    const previas = componentes.actividadesPrevias60a120Dias;
    if (recientes === 0 && previas > 0) puntosTendencia = 25;
    else if (recientes < previas) puntosTendencia = 15;
    desglose.push({
      criterio: 'tendencia_participacion',
      etiqueta: `${componentes.actividadesUltimos60Dias} actividades en los últimos 60 días, frente a ${componentes.actividadesPrevias60a120Dias} en los 60 días anteriores`,
      puntos: puntosTendencia,
    });
  }

  // C) Expediente y documentación
  let puntosExpediente = 0;
  if (componentes.porcentajeAvanceExpediente < 50) puntosExpediente += 10;
  if (componentes.tieneDocumentoVencido) puntosExpediente += 10;
  if (puntosExpediente > 0) {
    desglose.push({
      criterio: 'expediente_documentacion',
      etiqueta: [
        componentes.porcentajeAvanceExpediente < 50 ? `Expediente al ${componentes.porcentajeAvanceExpediente}%` : null,
        componentes.tieneDocumentoVencido ? 'Tiene documentación vencida' : null,
      ].filter(Boolean).join(' · '),
      puntos: puntosExpediente,
    });
  }

  // D) Bajo compromiso desde el inicio: solo aplica a voluntarios nuevos
  // (<60 días), para no solaparse con el criterio de tendencia (que ya
  // cubre a los veteranos). Evita que un voluntario recién llegado con 0
  // actividades quede fuera de cualquier señal de alerta temprana.
  let puntosCompromisoInicial = 0;
  if (componentes.antiguedadDias < 60 && componentes.actividadesCompletadasTotal === 0) {
    puntosCompromisoInicial = componentes.antiguedadDias >= 30 ? 15 : 5;
    desglose.push({
      criterio: 'compromiso_inicial',
      etiqueta: `Sin actividades completadas en sus primeros ${componentes.antiguedadDias} días`,
      puntos: puntosCompromisoInicial,
    });
  }

  const puntaje = Math.min(100, puntosInactividad + puntosTendencia + puntosExpediente + puntosCompromisoInicial);
  const nivel = NIVELES_RIESGO.find((n) => puntaje <= n.maximo);

  return {
    puntaje,
    nivel: nivel.clave,
    nivel_etiqueta: nivel.etiqueta,
    desglose: desglose.sort((a, b) => b.puntos - a.puntos),
  };
}

function puntosPorInactividad(dias) {
  if (dias <= 30) return 0;
  if (dias <= 60) return 10;
  if (dias <= 90) return 25;
  return 40;
}

module.exports = { calcularRiesgo, NIVELES_RIESGO };
