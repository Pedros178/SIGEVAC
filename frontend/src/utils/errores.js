/**
 * Mensaje comprensible para mostrar al usuario a partir de un error de axios.
 *  - Si el servidor respondió con un mensaje propio, se usa ese.
 *  - Si no hubo respuesta (servidor caído, sin internet, CORS), se evita mostrar el texto técnico
 *    del navegador ("Failed to fetch", "Network Error") y se explica qué pasó.
 */
export function mensajeDeError(err, porDefecto = 'Ocurrió un error inesperado. Intenta de nuevo.') {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (err?.response) return porDefecto;
  // Fallo de red real: fetch lanza TypeError ("Failed to fetch"/"Load failed"); axios, ERR_NETWORK
  const esFalloDeRed = err instanceof TypeError || err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
  if (esFalloDeRed) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo en unos minutos.';
  }
  // Error lanzado por la propia aplicación con un mensaje ya redactado para el usuario
  return err?.message || porDefecto;
}
