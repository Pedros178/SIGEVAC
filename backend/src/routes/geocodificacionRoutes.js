const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/geocodificacionController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

// Este proxy consume una cuota externa compartida (Nominatim limita a
// 1 req/s para toda la aplicación, no por usuario), así que se limita
// por usuario para que una sola sesión escribiendo rápido no agote la
// capacidad del resto. El cliente de geocodificación además cachea y
// serializa las peticiones salientes.
const limitadorGeocodificacion = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas búsquedas de ubicación. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Requiere sesión: solo se usa desde el formulario de actividades, y así
// el proxy no queda abierto como servicio de geocodificación gratuito.
router.use(autenticar);
router.use(limitadorGeocodificacion);

router.get('/buscar', controller.buscar);
router.get('/inverso', controller.inverso);

module.exports = router;
