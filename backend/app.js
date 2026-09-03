require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const { registrarTrazabilidad } = require('./src/middlewares/trazabilidad');

if (process.env.NODE_ENV === 'production') {
  const variablesRequeridas = [
    'DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL',
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET',
  ];
  const variablesFaltantes = variablesRequeridas.filter((nombre) => !process.env[nombre]);
  if (variablesFaltantes.length > 0) {
    throw new Error(`Faltan variables de producción: ${variablesFaltantes.join(', ')}`);
  }
}

const app = express();

// Necesario en producción: Render (y la mayoría de los PaaS) colocan la app
// detrás de un proxy inverso. Sin esto, express-rate-limit y req.ip verían
// la IP interna del proxy en vez de la IP real del cliente.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(registrarTrazabilidad); // Módulos 18 y 21: auditoría y bitácora (no bloquea la respuesta)

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
