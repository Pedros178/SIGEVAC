const AsociacionModel = require('../models/asociacionModel');

/**
 * Esta instalación de SIGEVAC está desplegada para UNA asociación (no es
 * un directorio multi-organización de cara al público, aunque el backend
 * sí soporte varias asociaciones internamente — ver Fase 7). Las páginas
 * públicas (Home: actividades, cifras, galería) necesitan saber de cuál
 * mostrar contenido.
 *
 * Se resuelve así:
 *   1. Variable de entorno ASOCIACION_PUBLICA_ID, si está configurada.
 *   2. Si no, la asociación más antigua (la creada por el seed inicial).
 *
 * Centralizado aquí porque más de un controlador público lo necesita
 * (paginaPublicaController, galeriaController) y no tiene sentido que
 * cada uno reimplemente o dependa de un helper interno de otro archivo.
 */
async function resolverAsociacionPublicaId() {
  if (process.env.ASOCIACION_PUBLICA_ID) return process.env.ASOCIACION_PUBLICA_ID;
  const asociaciones = await AsociacionModel.listar();
  return asociaciones[0]?.id || null;
}

module.exports = { resolverAsociacionPublicaId };
