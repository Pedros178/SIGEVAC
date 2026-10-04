/**
 * Escapa texto para insertarlo de forma segura dentro de HTML construido como
 * cadena (p. ej. la ventana de impresión de etiquetas QR, que usa
 * document.write y NO pasa por el escapado automático de React).
 */
export function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** HTML completo de la etiqueta imprimible de un artículo, con todos los datos escapados. */
export function construirHtmlEtiquetaQr(articulo, qrUrl) {
  const nombre = escaparHtml(articulo.nombre);
  return `<!doctype html><html><head><meta charset="utf-8"><title>QR - ${nombre}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px;color:#172b3a}img{width:320px;height:320px;image-rendering:pixelated}h1{font-size:22px;margin:0 0 8px}p{margin:6px 0;font-size:15px}</style></head><body><h1>${nombre}</h1><p>SKU: ${escaparHtml(articulo.sku || '—')}</p><img src="${escaparHtml(qrUrl)}" alt="Código QR de ${nombre}"><p>${escaparHtml(articulo.codigo_qr || '')}</p><script>window.onload=function(){window.print();}</script></body></html>`;
}
