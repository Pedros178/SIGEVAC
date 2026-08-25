const express = require('express');
const ActividadController = require('../controllers/actividadController');
const ParticipacionController = require('../controllers/participacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { upload } = require('../config/uploads');

const router = express.Router();

router.use(autenticar);

router.get('/', requierePermiso('actividades.consultar'), ActividadController.listar);
router.post('/', requierePermiso('actividades.crear'), ActividadController.crear);
router.get('/:id', requierePermiso('actividades.consultar'), ActividadController.obtener);
router.put('/:id', requierePermiso('actividades.crear'), ActividadController.actualizar);
router.post(
  '/:id/evidencias',
  requierePermiso('actividades.crear'),
  upload.single('evidencia'),
  ActividadController.agregarEvidencia
);

// Participación (Módulo 11) anidada bajo la actividad
router.post('/:actividadId/participaciones', requierePermiso('participaciones.gestionar'), ParticipacionController.inscribir);
router.get('/:actividadId/participaciones', requierePermiso('actividades.consultar'), ParticipacionController.listarPorActividad);

module.exports = router;
