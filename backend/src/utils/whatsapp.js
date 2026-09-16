async function enviarWhatsApp({ telefono, texto }) {
  if (!telefono || !process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { enviado: false, motivo: 'WhatsApp no configurado o sin teléfono' };
  }
  const respuesta = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefono, type: 'text', text: { body: texto } }),
  });
  if (!respuesta.ok) throw new Error(`WhatsApp API respondió ${respuesta.status}`);
  return { enviado: true };
}
module.exports = { enviarWhatsApp };
