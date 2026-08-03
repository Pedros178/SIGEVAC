const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const { autenticar } = require('../middlewares/auth');

const router = express.Router();

router.use(autenticar);

router.get('/', DashboardController.obtener);

module.exports = router;
