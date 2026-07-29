const express = require('express');
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const asociacionRoutes = require('./asociacionRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', servicio: 'SIGEVAC API', fecha: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/asociacion', asociacionRoutes);

// Los siguientes módulos se irán agregando en las próximas fases:
// router.use('/voluntarios', voluntarioRoutes);       // Fase 2
// router.use('/expedientes', expedienteRoutes);        // Fase 2
// router.use('/archivos', archivoRoutes);               // Fase 2
// router.use('/actividades', actividadRoutes);          // Fase 3
// router.use('/participaciones', participacionRoutes); // Fase 3
// router.use('/credenciales', credencialRoutes);        // Fase 3
// router.use('/reportes', reporteRoutes);                // Fase 4
// router.use('/notificaciones', notificacionRoutes);    // Fase 4
// router.use('/auditoria', auditoriaRoutes);             // Fase 5
// router.use('/configuracion', configuracionRoutes);    // Fase 5

module.exports = router;
