const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('../docs/openapi');
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const asociacionRoutes = require('./asociacionRoutes');
const voluntarioRoutes = require('./voluntarioRoutes');
const documentoRoutes = require('./documentoRoutes');
const archivoRoutes = require('./archivoRoutes');
const actividadRoutes = require('./actividadRoutes');
const participacionRoutes = require('./participacionRoutes');
const qrRoutes = require('./qrRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reporteRoutes = require('./reporteRoutes');
const notificacionRoutes = require('./notificacionRoutes');
const auditoriaRoutes = require('./auditoriaRoutes');
const configuracionRoutes = require('./configuracionRoutes');
const respaldoRoutes = require('./respaldoRoutes');
const portalRoutes = require('./portalRoutes');
const inventarioRoutes = require('./inventarioRoutes');
const cuotaRoutes = require('./cuotaRoutes');
const solicitudRoutes = require('./solicitudRoutes');
const publicRoutes = require('./publicRoutes');
const evidenciaRoutes = require('./evidenciaRoutes');
const insigniaRoutes = require('./insigniaRoutes');
const galeriaRoutes = require('./galeriaRoutes');
const geocodificacionRoutes = require('./geocodificacionRoutes');
const { query } = require('../config/database');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', servicio: 'SIGEVAC API', base_de_datos: 'ok', fecha: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', servicio: 'SIGEVAC API', base_de_datos: 'no disponible' });
  }
});

router.get('/catalogos/ubicaciones', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id AS estado_id, e.nombre AS estado, m.id AS municipio_id, m.nombre AS municipio
       FROM estados_mx e LEFT JOIN municipios m ON m.estado_id = e.id
       ORDER BY e.nombre, m.nombre`
    );
    return res.json({ ubicaciones: rows });
  } catch (err) {
    return next(err);
  }
});

// Módulo 22: documentación de la API. En producción NO se publica salvo que se
// pida explícitamente (ENABLE_API_DOCS=true): expone el mapa completo de endpoints.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
}

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/asociacion', asociacionRoutes);
router.use('/voluntarios', voluntarioRoutes);     // Fase 2: Módulos 4, 5, 6, 7, 9
router.use('/documentos', documentoRoutes);        // Fase 2: Módulos 7, 8, 9
router.use('/archivos', archivoRoutes);             // Fase 2: Módulo 8
router.use('/actividades', actividadRoutes);        // Fase 3: Módulos 10, 11
router.use('/participaciones', participacionRoutes);// Fase 3: Módulos 11, 12
router.use('/qr', qrRoutes);                         // Fase 3: Módulo 14
router.use('/dashboard', dashboardRoutes);           // Fase 4: Módulo 16
router.use('/reportes', reporteRoutes);              // Fase 4: Módulo 15
router.use('/notificaciones', notificacionRoutes);  // Fase 4: Módulo 17
router.use('/auditoria', auditoriaRoutes);           // Fase 5: Módulos 18, 21
router.use('/configuracion', configuracionRoutes);  // Fase 5: Módulo 19
router.use('/respaldos', respaldoRoutes);            // Fase 5: Módulo 20
router.use('/portal', portalRoutes);                  // Fase 6: Portal del voluntario/tutor
router.use('/inventario', inventarioRoutes);
router.use('/cuotas', cuotaRoutes);
router.use('/solicitudes', solicitudRoutes);
router.use('/publico', publicRoutes);
router.use('/evidencias', evidenciaRoutes); // servir fotos de evidencia (antes solo se podían subir, nunca ver)
router.use('/insignias', insigniaRoutes); // catálogo de gamificación
router.use('/galeria', galeriaRoutes); // administración de la galería de fotos pública
router.use('/geocodificacion', geocodificacionRoutes); // proxy de Nominatim (su política prohíbe llamarlo desde el navegador)

// Los siguientes módulos se irán agregando en las próximas fases:
// Fase 6: firma electrónica, generación de documentos, portal del voluntario/tutor, multi-asociación

module.exports = router;
