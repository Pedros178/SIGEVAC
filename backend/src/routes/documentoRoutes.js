const express = require('express');
const ExpedienteController = require('../controllers/expedienteController');
const ArchivoController = require('../controllers/archivoController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { upload } = require('../config/uploads');

const router = express.Router();

router.use(autenticar);

router.post('/:id/aprobar', requierePermiso('expedientes.aprobar'), ExpedienteController.aprobarDocumento);
router.post('/:id/rechazar', requierePermiso('expedientes.aprobar'), ExpedienteController.rechazarDocumento);

// Gestor de archivos (Módulo 8): subir nueva versión y ver historial
router.post(
  '/:documentoId/archivos',
  requierePermiso('voluntarios.editar'),
  upload.single('archivo'),
  ArchivoController.subir
);
router.get(
  '/:documentoId/archivos',
  requierePermiso('expedientes.consultar'),
  ArchivoController.listarHistorial
);

module.exports = router;
