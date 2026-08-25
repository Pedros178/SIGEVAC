const NotificacionModel = require('../models/notificacionModel');
const { enviarCorreo } = require('../utils/email');
const { enviarWhatsApp } = require('../utils/whatsapp');

function notificarWhatsAppBestEffort(telefono, texto) {
  return enviarWhatsApp({ telefono, texto }).catch((err) => console.error('No se pudo enviar WhatsApp:', err.message));
}

/**
 * Todas las funciones de este servicio son "best-effort": no lanzan errores
 * hacia el llamador, para no interrumpir el flujo principal (aprobar un
 * documento, crear una actividad, etc.) si falla el envío de un correo.
 */
async function notificarDocumentoRechazado({ voluntario, documento }) {
  try {
    const titulo = `Documento rechazado: ${documento.tipo_etiqueta}`;
    const mensaje = documento.observaciones || 'Revisa tu expediente para más detalles.';
    const resultado = await enviarCorreo({
      to: voluntario.correo,
      subject: `SIGEVAC — ${titulo}`,
      html: `<p>Hola ${voluntario.nombre},</p><p>Tu documento <strong>${documento.tipo_etiqueta}</strong> fue rechazado.</p><p>Motivo: ${mensaje}</p><p>Por favor vuelve a cargarlo lo antes posible.</p>`,
    });
    await notificarWhatsAppBestEffort(voluntario.telefono, `${titulo}. Motivo: ${mensaje}`);
    await NotificacionModel.crear({
      voluntarioId: voluntario.id, tipo: 'documento_rechazado', titulo, mensaje,
      enviadaPorCorreo: resultado.enviado,
    });
  } catch (err) {
    console.error('No se pudo notificar el rechazo del documento:', err.message);
  }
}

async function notificarExpedienteAprobado({ voluntario }) {
  try {
    const titulo = 'Tu expediente ha sido aprobado';
    const mensaje = 'Todos tus documentos fueron revisados y aprobados. Tu expediente está completo.';
    const resultado = await enviarCorreo({
      to: voluntario.correo,
      subject: `SIGEVAC — ${titulo}`,
      html: `<p>Hola ${voluntario.nombre},</p><p>${mensaje}</p>`,
    });
    await notificarWhatsAppBestEffort(voluntario.telefono, mensaje);
    await NotificacionModel.crear({
      voluntarioId: voluntario.id, tipo: 'expediente_aprobado', titulo, mensaje,
      enviadaPorCorreo: resultado.enviado,
    });
  } catch (err) {
    console.error('No se pudo notificar la aprobación del expediente:', err.message);
  }
}

async function notificarDocumentoFaltante({ voluntario, documento }) {
  try {
    const titulo = `Documento pendiente: ${documento.tipo_etiqueta}`;
    const mensaje = `Aún no has cargado tu documento "${documento.tipo_etiqueta}".`;
    const resultado = await enviarCorreo({
      to: voluntario.correo,
      subject: `SIGEVAC — ${titulo}`,
      html: `<p>Hola ${voluntario.nombre},</p><p>${mensaje}</p>`,
    });
    await notificarWhatsAppBestEffort(voluntario.telefono, mensaje);
    await NotificacionModel.crear({
      voluntarioId: voluntario.id, tipo: 'documento_faltante', titulo, mensaje,
      enviadaPorCorreo: resultado.enviado,
    });
  } catch (err) {
    console.error('No se pudo notificar el documento faltante:', err.message);
  }
}

/**
 * Módulo 17 (diferenciador — control de vigencia de documentos): avisa al
 * voluntario y, dentro del sistema, a los usuarios internos de su
 * asociación, que un documento aprobado está por vencer.
 */
async function notificarDocumentoPorVencer({ voluntario, documento }) {
  try {
    const fecha = new Date(documento.vigencia_hasta).toLocaleDateString('es-MX');
    const yaVencio = new Date(documento.vigencia_hasta) < new Date();
    const titulo = yaVencio
      ? `Documento vencido: ${documento.tipo_etiqueta}`
      : `Documento por vencer: ${documento.tipo_etiqueta}`;
    const mensaje = yaVencio
      ? `Tu documento "${documento.tipo_etiqueta}" venció el ${fecha}. Súbelo de nuevo actualizado.`
      : `Tu documento "${documento.tipo_etiqueta}" vence el ${fecha}. Súbelo de nuevo antes de esa fecha para mantener tu expediente al día.`;

    const resultado = await enviarCorreo({
      to: voluntario.correo,
      subject: `SIGEVAC — ${titulo}`,
      html: `<p>Hola ${voluntario.nombre},</p><p>${mensaje}</p>`,
    });
    await NotificacionModel.crear({
      voluntarioId: voluntario.id, tipo: 'documento_por_vencer', titulo, mensaje,
      enviadaPorCorreo: resultado.enviado,
    });

    // Aviso interno (sin correo masivo) a los usuarios de la asociación,
    // para que coordinación también lo vea en su panel de notificaciones.
    if (documento.asociacion_id) {
      const usuariosInternos = await NotificacionModel.listarUsuariosPorAsociacion(documento.asociacion_id);
      await Promise.all(
        usuariosInternos.map((u) => NotificacionModel.crear({
          usuarioId: u.id,
          tipo: 'documento_por_vencer',
          titulo: `${titulo} — ${voluntario.nombre}`,
          mensaje,
          enviadaPorCorreo: false,
        }))
      );
    }
  } catch (err) {
    console.error('No se pudo notificar la vigencia del documento:', err.message);
  }
}

/**
 * Notifica internamente (dentro del sistema) a los usuarios de la
 * asociación sobre una nueva actividad. No se envía correo masivo aquí
 * para evitar spam; solo se crea el registro visible en el panel.
 */
async function notificarNuevaActividad({ actividad, asociacionId }) {
  try {
    const usuarios = await NotificacionModel.listarUsuariosPorAsociacion(asociacionId);
    const titulo = `Nueva actividad: ${actividad.nombre}`;
    const mensaje = `Programada para el ${new Date(actividad.fecha).toLocaleDateString('es-MX')}${actividad.lugar ? ` en ${actividad.lugar}` : ''}.`;
    await Promise.all(
      usuarios.map((u) => NotificacionModel.crear({
        usuarioId: u.id, tipo: 'nueva_actividad', titulo, mensaje, enviadaPorCorreo: false,
      }))
    );
  } catch (err) {
    console.error('No se pudo notificar la nueva actividad:', err.message);
  }
}

module.exports = {
  notificarDocumentoRechazado,
  notificarExpedienteAprobado,
  notificarDocumentoFaltante,
  notificarDocumentoPorVencer,
  notificarNuevaActividad,
};
