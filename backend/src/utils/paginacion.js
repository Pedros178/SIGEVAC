/**
 * Lee `limit` y `offset` de la query string y los normaliza.
 * Nunca lanza: valores ausentes, no numéricos o negativos vuelven al valor
 * por defecto, y `limit` se acota a `maximo` (evita pedir millones de filas).
 */
function leerPaginacion(query = {}, { porDefecto = 50, maximo = 200 } = {}) {
  const lim = Number.parseInt(query.limit, 10);
  const off = Number.parseInt(query.offset, 10);
  const limit = Number.isFinite(lim) && lim > 0 ? Math.min(lim, maximo) : porDefecto;
  const offset = Number.isFinite(off) && off > 0 ? off : 0;
  return { limit, offset };
}

module.exports = { leerPaginacion };
