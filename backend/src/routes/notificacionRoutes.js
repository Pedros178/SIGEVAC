const express = require('express');
const NotificacionController = require('../controllers/notificacionController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', NotificacionController.listar);
router.patch('/:id/leida', NotificacionController.marcarLeida);

module.exports = router;
