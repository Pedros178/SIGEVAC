const express = require('express');
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const asociacionRoutes = require('./asociacionRoutes');
const voluntarioRoutes = require('./voluntarioRoutes');
const documentoRoutes = require('./documentoRoutes');
const archivoRoutes = require('./archivoRoutes');
const actividadRoutes = require('./actividadRoutes');
const participacionRoutes = require('./participacionRoutes');
const qrRoutes = require('./qrRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', servicio: 'SIGEVAC API', fecha: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/asociacion', asociacionRoutes);
router.use('/voluntarios', voluntarioRoutes);     // Fase 2: Módulos 4, 5, 6, 7, 9
router.use('/documentos', documentoRoutes);        // Fase 2: Módulos 7, 8, 9
router.use('/archivos', archivoRoutes);             // Fase 2: Módulo 8
router.use('/actividades', actividadRoutes);        // Fase 3: Módulos 10, 11
router.use('/participaciones', participacionRoutes);// Fase 3: Módulos 11, 12
router.use('/qr', qrRoutes);                         // Fase 3: Módulo 14

// Los siguientes módulos se irán agregando en las próximas fases:
// router.use('/credenciales', credencialRoutes);        // Fase 3 (ya cubierto por /voluntarios/:id/credencial)
// router.use('/reportes', reporteRoutes);                // Fase 4
// router.use('/notificaciones', notificacionRoutes);    // Fase 4
// router.use('/auditoria', auditoriaRoutes);             // Fase 5
// router.use('/configuracion', configuracionRoutes);    // Fase 5

module.exports = router;
