/**
 * Integración con la WhatsApp Business Cloud API de Meta.
 *
 * Punto clave que condiciona todo este módulo: Meta solo permite enviar
 * mensajes de texto libre (`type: 'text'`) dentro de la "ventana de
 * atención al cliente" de 24 horas, que se abre únicamente cuando el
 * usuario le escribe primero a la empresa. Todas las notificaciones que
 * envía SIGEVAC (documento rechazado, expediente aprobado, documento por
 * vencer) son mensajes *iniciados por la asociación*, no respuestas — así
 * que fuera de esa ventana Meta las rechaza con el error 131047 y el
 * voluntario nunca las recibe.
 *
 * Por eso el envío por defecto usa `type: 'template'` con una plantilla
 * previamente aprobada en el WhatsApp Manager de Meta. El texto libre
 * queda disponible (`enviarWhatsAppTexto`) solo para responder dentro de
 * la ventana de 24 h, que hoy el sistema no usa pero podría necesitar si
 * más adelante se recibe mensajería entrante.
 */

const URL_BASE = 'https://graph.facebook.com/v20.0';
const CODIGO_PAIS_POR_DEFECTO = process.env.WHATSAPP_CODIGO_PAIS || '52'; // México

/**
 * Normaliza un teléfono al formato internacional que exige Meta (E.164
 * sin el signo `+`). En la base de datos los teléfonos se capturan como
 * números locales de 10 dígitos ("2381234567"), y también pueden traer
 * espacios, guiones o paréntesis según cómo los escribió el capturista.
 *
 * Reglas aplicadas, pensadas para México:
 * - Se descarta todo lo que no sea dígito.
 * - 10 dígitos -> se antepone el código de país (52 por defecto).
 * - Ya viene con el código de país y largo plausible -> se deja igual.
 * - Cualquier otra longitud se considera no confiable y devuelve null,
 *   para no mandarle un mensaje a un número equivocado.
 */
function normalizarTelefono(telefono) {
  if (!telefono) return null;
  const digitos = String(telefono).replace(/\D/g, '');
  if (!digitos) return null;

  if (digitos.length === 10) return `${CODIGO_PAIS_POR_DEFECTO}${digitos}`;
  if (digitos.startsWith(CODIGO_PAIS_POR_DEFECTO) && (digitos.length === 12 || digitos.length === 13)) return digitos;
  // Números de otros países ya en formato internacional (largo plausible).
  if (digitos.length >= 11 && digitos.length <= 15) return digitos;
  return null;
}

function estaConfigurado() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Envía el payload ya armado y traduce los errores de Meta a mensajes
 * accionables. Meta responde con el detalle del error en el cuerpo tanto
 * en respuestas 4xx como, en algunos casos, en respuestas 200.
 */
async function enviarPayload(payload) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // no dejar colgada la notificación si Meta no responde
    });
  } catch (err) {
    throw new Error(`No se pudo contactar la API de WhatsApp: ${err.message}`);
  }

  const cuerpo = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || cuerpo.error) {
    const error = cuerpo.error || {};
    const codigo = error.code;
    let detalle = error.message || `HTTP ${respuesta.status}`;

    // Los códigos más frecuentes en producción, explicados para que en
    // los logs se vea qué hay que corregir y no solo "falló el envío".
    if (codigo === 131047) {
      detalle = 'La ventana de 24 h está cerrada: este mensaje debe enviarse como plantilla aprobada (type: template), no como texto libre.';
    } else if (codigo === 132001) {
      detalle = `La plantilla no existe o no está aprobada en el WhatsApp Manager (nombre/idioma incorrectos). Detalle de Meta: ${error.message}`;
    } else if (codigo === 131026) {
      detalle = 'El número destino no tiene WhatsApp o no puede recibir mensajes.';
    } else if (codigo === 190) {
      detalle = 'El WHATSAPP_ACCESS_TOKEN es inválido o expiró (los tokens temporales duran 24 h; usa uno permanente de System User).';
    } else if (codigo === 131030) {
      detalle = 'El número destino no está en la lista de destinatarios permitidos (la cuenta sigue en modo de prueba en Meta).';
    }

    const fallo = new Error(`WhatsApp API: ${detalle}`);
    fallo.codigoMeta = codigo;
    throw fallo;
  }

  return { enviado: true, id: cuerpo.messages?.[0]?.id };
}

/**
 * Envía una notificación usando una plantilla aprobada por Meta. Es la
 * vía correcta para cualquier mensaje que inicie la asociación.
 *
 * @param {string} telefono - Teléfono del destinatario, en cualquier formato.
 * @param {string} plantilla - Nombre exacto de la plantilla aprobada.
 * @param {string[]} parametros - Valores para las variables {{1}}, {{2}}... del cuerpo.
 * @param {string} idioma - Código de idioma de la plantilla (por defecto es_MX).
 */
async function enviarWhatsAppPlantilla({ telefono, plantilla, parametros = [], idioma }) {
  if (!estaConfigurado()) {
    return { enviado: false, motivo: 'WhatsApp no configurado' };
  }
  const destino = normalizarTelefono(telefono);
  if (!destino) {
    return { enviado: false, motivo: `Teléfono ausente o con formato no reconocible: ${telefono ?? '(vacío)'}` };
  }
  const nombrePlantilla = plantilla || process.env.WHATSAPP_TEMPLATE_NOTIFICACION;
  if (!nombrePlantilla) {
    return { enviado: false, motivo: 'No hay plantilla configurada (WHATSAPP_TEMPLATE_NOTIFICACION)' };
  }

  const componentes = parametros.length > 0
    ? [{ type: 'body', parameters: parametros.map((valor) => ({ type: 'text', text: String(valor) })) }]
    : [];

  return enviarPayload({
    messaging_product: 'whatsapp',
    to: destino,
    type: 'template',
    template: {
      name: nombrePlantilla,
      language: { code: idioma || process.env.WHATSAPP_TEMPLATE_IDIOMA || 'es_MX' },
      ...(componentes.length > 0 ? { components: componentes } : {}),
    },
  });
}

/**
 * Envía texto libre. Solo funciona dentro de la ventana de 24 h abierta
 * por un mensaje del usuario; fuera de ella Meta responde 131047. No se
 * usa para las notificaciones automáticas del sistema, justamente por eso.
 */
async function enviarWhatsAppTexto({ telefono, texto }) {
  if (!estaConfigurado()) {
    return { enviado: false, motivo: 'WhatsApp no configurado' };
  }
  const destino = normalizarTelefono(telefono);
  if (!destino) {
    return { enviado: false, motivo: `Teléfono ausente o con formato no reconocible: ${telefono ?? '(vacío)'}` };
  }

  return enviarPayload({
    messaging_product: 'whatsapp',
    to: destino,
    type: 'text',
    text: { body: texto },
  });
}

/**
 * Punto de entrada que usan las notificaciones del sistema. Envía por
 * plantilla (lo correcto para mensajes iniciados por la asociación) y,
 * si no hay plantilla configurada, lo informa en vez de intentar un
 * texto libre que Meta rechazaría de todos modos.
 */
async function enviarWhatsApp({ telefono, texto, plantilla, parametros }) {
  if (!estaConfigurado()) {
    return { enviado: false, motivo: 'WhatsApp no configurado o sin teléfono' };
  }
  const nombrePlantilla = plantilla || process.env.WHATSAPP_TEMPLATE_NOTIFICACION;
  if (!nombrePlantilla) {
    return {
      enviado: false,
      motivo: 'WhatsApp configurado pero sin WHATSAPP_TEMPLATE_NOTIFICACION. '
        + 'Meta rechaza el texto libre en mensajes iniciados por la asociación (error 131047); '
        + 'crea y aprueba una plantilla en el WhatsApp Manager y configúrala. Ver DEPLOY.md.',
    };
  }
  // Si no se pasan parámetros explícitos, se asume una plantilla de una
  // sola variable {{1}} que recibe el texto completo de la notificación.
  return enviarWhatsAppPlantilla({
    telefono,
    plantilla: nombrePlantilla,
    parametros: parametros || [texto],
  });
}

module.exports = {
  enviarWhatsApp,
  enviarWhatsAppPlantilla,
  enviarWhatsAppTexto,
  normalizarTelefono,
};
