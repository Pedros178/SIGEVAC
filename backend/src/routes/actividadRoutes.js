const express = require('express');
const ActividadController = require('../controllers/actividadController');
const ParticipacionController = require('../controllers/participacionController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { actividadDeAsociacion } = require('../middlewares/aislamiento');
const { upload } = require('../config/uploads');
const { verificarContenidoArchivo } = require('../middlewares/validarArchivo');

const router = express.Router();

router.use(autenticar);

router.get('/', requierePermiso('actividades.consultar'), ActividadController.listar);
router.post('/', requierePermiso('actividades.crear'), ActividadController.crear);
router.get('/:id', requierePermiso('actividades.consultar'), actividadDeAsociacion(), ActividadController.obtener);
router.put('/:id', requierePermiso('actividades.crear'), actividadDeAsociacion(), ActividadController.actualizar);
router.post(
  '/:id/evidencias',
  requierePermiso('actividades.crear'),
  actividadDeAsociacion(),
  upload.single('evidencia'),
  verificarContenidoArchivo,
  ActividadController.agregarEvidencia
);

// Participación (Módulo 11) anidada bajo la actividad
router.post('/:actividadId/participaciones', requierePermiso('participaciones.gestionar'), actividadDeAsociacion('actividadId'), ParticipacionController.inscribir);
router.get('/:actividadId/participaciones', requierePermiso('actividades.consultar'), actividadDeAsociacion('actividadId'), ParticipacionController.listarPorActividad);

module.exports = router;
