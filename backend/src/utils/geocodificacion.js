/**
 * Cliente de geocodificación contra Nominatim (OpenStreetMap).
 *
 * Existe porque la política de uso de Nominatim no permite llamarlo
 * directamente desde el navegador, como se hacía antes:
 *
 * 1. Exige un User-Agent que identifique la aplicación — y el navegador
 *    no deja fijar ese header desde `fetch`, así que las peticiones
 *    salían con el User-Agent genérico del navegador. Nominatim bloquea
 *    justamente ese tipo de tráfico no identificado (responde 403).
 * 2. El límite es de 1 petición por segundo *sumando todos los usuarios*
 *    de la aplicación, no por usuario. Con el buscador llamando desde
 *    cada navegador no había forma de respetarlo.
 * 3. Prohíbe explícitamente usar la API pública como backend de
 *    autocompletado.
 *
 * Al pasar por el servidor se puede mandar el User-Agent correcto,
 * serializar las peticiones a 1/s para toda la instancia, y cachear las
 * búsquedas repetidas (que son muchas: los voluntarios buscan una y otra
 * vez los mismos lugares de la región).
 */

const URL_NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

// Nominatim exige un User-Agent con un contacto real (una URL o correo
// que resuelva). Si el despliegue no lo configura, se usa el repositorio
// del proyecto como contacto, que sí existe.
const USER_AGENT = process.env.NOMINATIM_USER_AGENT
  || 'SIGEVAC/1.0 (+https://github.com/Pedros178/SIGEVAC)';

const MS_ENTRE_PETICIONES = 1000; // política: máximo 1 req/s para toda la app
const TTL_CACHE_MS = 24 * 60 * 60 * 1000; // los lugares no se mueven; 24 h es conservador
const MAX_ENTRADAS_CACHE = 500;

const cache = new Map(); // clave -> { expira, datos }
let ultimaPeticion = 0;
let cadenaDeEspera = Promise.resolve(); // serializa las peticiones salientes

function leerCache(clave) {
  const entrada = cache.get(clave);
  if (!entrada) return null;
  if (Date.now() > entrada.expira) {
    cache.delete(clave);
    return null;
  }
  // Refrescar posición para que el descarte sea aproximadamente LRU.
  cache.delete(clave);
  cache.set(clave, entrada);
  return entrada.datos;
}

function guardarEnCache(clave, datos) {
  if (cache.size >= MAX_ENTRADAS_CACHE) {
    const masAntigua = cache.keys().next().value;
    cache.delete(masAntigua);
  }
  cache.set(clave, { expira: Date.now() + TTL_CACHE_MS, datos });
}

/**
 * Encola una petición respetando el mínimo de 1 segundo entre llamadas
 * salientes. Las peticiones concurrentes se serializan en vez de
 * dispararse todas juntas y arriesgar un bloqueo de Nominatim.
 */
function encolar(tarea) {
  const resultado = cadenaDeEspera.then(async () => {
    const espera = Math.max(0, MS_ENTRE_PETICIONES - (Date.now() - ultimaPeticion));
    if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
    ultimaPeticion = Date.now();
    return tarea();
  });
  // La cadena nunca debe romperse por un fallo individual.
  cadenaDeEspera = resultado.then(() => undefined, () => undefined);
  return resultado;
}

async function pedirANominatim(ruta, parametros) {
  const url = `${URL_NOMINATIM}${ruta}?${new URLSearchParams(parametros)}`;
  const respuesta = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (respuesta.status === 403 || respuesta.status === 429) {
    const error = new Error('El servicio de mapas limitó las peticiones. Intenta de nuevo en un momento.');
    error.codigo = 'limite_excedido';
    throw error;
  }
  if (!respuesta.ok) {
    throw new Error(`Nominatim respondió ${respuesta.status}`);
  }
  return respuesta.json();
}

/**
 * Busca lugares por nombre o dirección. Devuelve solo los campos que el
 * frontend necesita, en vez de reenviar la respuesta completa.
 */
async function buscarLugares(termino, limite = 6) {
  const consulta = String(termino || '').trim();
  if (consulta.length < 3) return [];

  const clave = `buscar:${consulta.toLowerCase()}:${limite}`;
  const enCache = leerCache(clave);
  if (enCache) return enCache;

  const resultados = await encolar(() => pedirANominatim('/search', {
    format: 'json',
    addressdetails: 1,
    limit: limite,
    countrycodes: process.env.NOMINATIM_PAISES || 'mx',
    q: consulta,
  }));

  const lugares = (Array.isArray(resultados) ? resultados : []).map((r) => ({
    place_id: r.place_id,
    display_name: r.display_name,
    lat: r.lat,
    lon: r.lon,
  }));

  guardarEnCache(clave, lugares);
  return lugares;
}

/**
 * Geocodificación inversa: de coordenadas a nombre de lugar. Se usa
 * cuando el usuario marca un punto directamente en el mapa, para poder
 * guardar también una dirección legible y no solo un par de números.
 */
async function nombrarCoordenadas(latitud, longitud) {
  const lat = Number(latitud);
  const lon = Number(longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  // Redondear a ~11 m evita pedir dos veces lo mismo por diferencias
  // irrelevantes de decimales y mejora mucho el aprovechamiento del caché.
  const clave = `inverso:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const enCache = leerCache(clave);
  if (enCache) return enCache;

  const resultado = await encolar(() => pedirANominatim('/reverse', {
    format: 'json',
    addressdetails: 1,
    lat: String(lat),
    lon: String(lon),
  }));

  const lugar = resultado && resultado.display_name
    ? { display_name: resultado.display_name, lat: resultado.lat, lon: resultado.lon }
    : null;

  if (lugar) guardarEnCache(clave, lugar);
  return lugar;
}

module.exports = { buscarLugares, nombrarCoordenadas };
