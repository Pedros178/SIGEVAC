/**
 * Cabecera Content-Disposition correcta para nombres con acentos, espacios o
 * caracteres especiales: `filename` ASCII de respaldo + `filename*` (RFC 5987).
 * Antes se hacía encodeURIComponent dentro de comillas, de modo que el usuario
 * descargaba "Constancia%20Mar%C3%ADa.pdf". También neutraliza comillas y
 * saltos de línea (inyección de cabeceras).
 */
function contentDisposition(tipo, nombre) {
  const limpio = String(nombre || 'archivo').replace(/[\r\n"\\/]/g, '_');
  const ascii = limpio.replace(/[^\x20-\x7E]/g, '_');
  const codificado = encodeURIComponent(limpio).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}

module.exports = { contentDisposition };
