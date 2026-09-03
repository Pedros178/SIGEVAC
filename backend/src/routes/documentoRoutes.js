const express = require('express');
const ExpedienteController = require('../controllers/expedienteController');
const ArchivoController = require('../controllers/archivoController');
const DiferenciadorController = require('../controllers/diferenciadorController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { documentoDeAsociacion } = require('../middlewares/aislamiento');
const { upload } = require('../config/uploads');
const { verificarContenidoArchivo } = require('../middlewares/validarArchivo');

const router = express.Router();

router.use(autenticar);

router.get('/plantillas/disponibles', DiferenciadorController.listarPlantillasDisponibles);

router.post('/:id/aprobar', requierePermiso('expedientes.aprobar'), documentoDeAsociacion(), ExpedienteController.aprobarDocumento);
router.post('/:id/rechazar', requierePermiso('expedientes.aprobar'), documentoDeAsociacion(), ExpedienteController.rechazarDocumento);

// Fase 6 (diferenciador): generación automática de documentos y firma electrónica
router.post('/:id/generar', requierePermiso('voluntarios.editar'), documentoDeAsociacion(), DiferenciadorController.generarDesdeePlantilla);
router.post('/:id/firmar', requierePermiso('voluntarios.editar'), documentoDeAsociacion(), DiferenciadorController.firmar);
router.get('/:id/firma', requierePermiso('expedientes.consultar'), documentoDeAsociacion(), DiferenciadorController.obtenerFirma);

// Gestor de archivos (Módulo 8): subir nueva versión y ver historial
router.post(
  '/:documentoId/archivos',
  requierePermiso('voluntarios.editar'),
  documentoDeAsociacion('documentoId'),
  upload.single('archivo'),
  verificarContenidoArchivo,
  ArchivoController.subir
);
router.get(
  '/:documentoId/archivos',
  requierePermiso('expedientes.consultar'),
  documentoDeAsociacion('documentoId'),
  ArchivoController.listarHistorial
);

module.exports = router;
