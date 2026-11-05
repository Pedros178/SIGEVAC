require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const { registrarTrazabilidad } = require('./src/middlewares/trazabilidad');
const { validarEntornoProduccion } = require('./src/utils/validarEntorno');
const { limitadorGeneral } = require('./src/middlewares/limitadores');

// La validación de abajo se dispara con NODE_ENV=production (como pide
// DEPLOY.md) pero TAMBIÉN si detecta que corre dentro de Render
// (`RENDER=true`, variable que Render fija automáticamente en todos sus
// servicios, sin que el usuario la configure). Esto evita el caso real
// más común de que "las imágenes de la galería no cargan": alguien
// despliega en Render pero olvida fijar NODE_ENV=production exactamente,
// la comprobación original nunca se activa, el backend arranca "bien"
// guardando archivos en el disco local de Render, y semanas después ese
// disco se borra en un reinicio/redeploy silenciosamente.
if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
  const problemas = validarEntornoProduccion(process.env);
  if (problemas.length > 0) {
    throw new Error(`Configuración de producción inválida:\n - ${problemas.join('\n - ')}`);
  }
}

const app = express();

// Necesario en producción: Render (y la mayoría de los PaaS) colocan la app
// detrás de un proxy inverso. Sin esto, express-rate-limit y req.ip verían
// la IP interna del proxy en vez de la IP real del cliente.
app.set('trust proxy', 1);

app.use(helmet());

// swagger-ui-express (montado en /api/docs, ver src/routes/index.js) inyecta
// un <script> inline para inicializar la interfaz — el CSP por defecto de
// helmet (script-src 'self', sin 'unsafe-inline') lo bloquearía y dejaría
// la documentación en blanco. Se quita el header CSP únicamente en esa
// ruta (llamar helmet() de nuevo con contentSecurityPolicy:false NO basta,
// porque no borra el header que ya dejó la llamada anterior); el resto de
// la API (que solo responde JSON) conserva el CSP estricto.
app.use('/api/docs', (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
// extended:false → analizador simple (querystring): evita las estructuras anidadas/objetos de `qs`, que la API no usa.
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(registrarTrazabilidad); // Módulos 18 y 21: auditoría y bitácora (no bloquea la respuesta)

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', limitadorGeneral());
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
