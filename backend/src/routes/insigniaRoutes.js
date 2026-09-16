const express = require('express');
const InsigniaController = require('../controllers/insigniaController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

// Catálogo completo: cualquier usuario autenticado puede verlo (no expone
// datos de ningún voluntario, solo el listado de insignias disponibles).
router.get('/', InsigniaController.listarCatalogo);

module.exports = router;
