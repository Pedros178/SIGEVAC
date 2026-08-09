require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const { registrarTrazabilidad } = require('./src/middlewares/trazabilidad');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(registrarTrazabilidad); // Módulos 18 y 21: auditoría y bitácora (no bloquea la respuesta)

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
