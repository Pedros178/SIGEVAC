const express = require('express');
const VoluntarioController = require('../controllers/voluntarioController');
const ExpedienteController = require('../controllers/expedienteController');
const CredencialController = require('../controllers/credencialController');
const ParticipacionController = require('../controllers/participacionController');
const FichaController = require('../controllers/fichaController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { upload } = require('../config/uploads');

const router = express.Router();

router.use(autenticar);

router.get('/tipos/disponibles', VoluntarioController.listarTiposDisponibles);

router.get('/', requierePermiso('voluntarios.consultar'), VoluntarioController.listar);
router.post('/', requierePermiso('voluntarios.crear'), VoluntarioController.crear);
router.post('/importar', requierePermiso('voluntarios.crear'), upload.single('archivo'), VoluntarioController.importar);
router.get('/:id', requierePermiso('voluntarios.consultar'), VoluntarioController.obtener);
router.put('/:id', requierePermiso('voluntarios.editar'), VoluntarioController.actualizar);
router.delete('/:id', requierePermiso('voluntarios.eliminar'), VoluntarioController.desactivar);
router.post('/:id/foto', requierePermiso('voluntarios.editar'), upload.single('foto'), VoluntarioController.subirFoto);
router.get('/:id/foto', requierePermiso('voluntarios.consultar'), VoluntarioController.obtenerFoto);

// Expediente digital del voluntario (Módulos 7, 8, 9)
router.get('/:voluntarioId/expediente', requierePermiso('expedientes.consultar'), ExpedienteController.obtener);
router.post('/:voluntarioId/expediente/notificar-faltantes', requierePermiso('expedientes.aprobar'), ExpedienteController.notificarFaltantes);

// Credencial digital, QR y horas de servicio (Módulos 12, 13, 14)
router.get('/:id/credencial', requierePermiso('expedientes.consultar'), CredencialController.obtener);
router.post('/:id/credencial', requierePermiso('credenciales.generar'), CredencialController.generar);
router.get('/:id/horas-servicio', requierePermiso('expedientes.consultar'), CredencialController.resumenHoras);
router.get('/:voluntarioId/participaciones', requierePermiso('actividades.consultar'), ParticipacionController.listarPorVoluntario);

// Ficha del integrante — PDF/Excel imprimibles con foto y datos (diferenciador)
router.get('/:id/ficha.pdf', requierePermiso('expedientes.consultar'), FichaController.generarPdf);
router.get('/:id/ficha.xlsx', requierePermiso('expedientes.consultar'), FichaController.generarExcel);

module.exports = router;
