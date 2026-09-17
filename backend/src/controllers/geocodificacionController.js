const { buscarLugares, nombrarCoordenadas } = require('../utils/geocodificacion');

/**
 * Proxy de geocodificación. El frontend ya no llama a Nominatim
 * directamente (su política de uso no lo permite desde el navegador —
 * ver src/utils/geocodificacion.js); pasa por aquí, donde sí se puede
 * enviar un User-Agent identificable, respetar el límite de 1 req/s de
 * toda la aplicación y cachear las búsquedas repetidas.
 */
const GeocodificacionController = {
  async buscar(req, res, next) {
    try {
      const termino = req.query.q;
      if (!termino || String(termino).trim().length < 3) {
        return res.status(400).json({ error: 'Escribe al menos 3 caracteres para buscar.' });
      }
      const lugares = await buscarLugares(termino);
      return res.json({ lugares });
    } catch (err) {
      if (err.codigo === 'limite_excedido') {
        return res.status(503).json({ error: err.message });
      }
      return next(err);
    }
  },

  async inverso(req, res, next) {
    try {
      const { lat, lon } = req.query;
      if (lat === undefined || lon === undefined) {
        return res.status(400).json({ error: 'Se requieren los parámetros lat y lon.' });
      }
      const lugar = await nombrarCoordenadas(lat, lon);
      if (!lugar) return res.status(404).json({ error: 'No se encontró una dirección para esas coordenadas.' });
      return res.json({ lugar });
    } catch (err) {
      if (err.codigo === 'limite_excedido') {
        return res.status(503).json({ error: err.message });
      }
      return next(err);
    }
  },
};

module.exports = GeocodificacionController;
