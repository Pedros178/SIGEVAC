const nodemailer = require('nodemailer');

let transportador = null;

function obtenerTransportador() {
  if (transportador) return transportador;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // SMTP no configurado: se opera en modo "solo registro" (ver enviarCorreo)
  }
  transportador = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transportador;
}

/**
 * Envía un correo si SMTP está configurado; si no, solo lo registra en consola
 * (útil en desarrollo y para no bloquear el flujo de la aplicación).
 * Nunca lanza: los llamadores la usan de forma "best-effort".
 */
async function enviarCorreo({ to, subject, html }) {
  if (!to) return { enviado: false, motivo: 'Sin destinatario' };

  const transporte = obtenerTransportador();
  if (!transporte) {
    console.log(`[correo no enviado — SMTP no configurado] Para: ${to} | Asunto: ${subject}`);
    return { enviado: false, motivo: 'SMTP no configurado' };
  }

  try {
    await transporte.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { enviado: true };
  } catch (err) {
    console.error('Error enviando correo:', err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { enviarCorreo };
