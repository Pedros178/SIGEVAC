const express = require('express');
const UsuarioController = require('../controllers/usuarioController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso, requiereRol } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.get('/roles/disponibles', UsuarioController.listarRoles);
router.get('/roles/permisos', requiereRol('super_admin'), UsuarioController.listarPermisos);
router.post('/roles', requiereRol('super_admin'), UsuarioController.crearRol);
router.get('/roles/:rolId/permisos', requiereRol('super_admin'), UsuarioController.listarPermisosRol);
router.put('/roles/:rolId/permisos', requiereRol('super_admin'), UsuarioController.actualizarPermisosRol);
router.get('/', requierePermiso('usuarios.consultar'), UsuarioController.listar);
router.get('/:id', requierePermiso('usuarios.consultar'), UsuarioController.obtener);
router.post('/', requierePermiso('usuarios.crear'), UsuarioController.crear);
router.put('/:id', requierePermiso('usuarios.editar'), UsuarioController.actualizar);

// Multi-asociación: cruza el aislamiento de datos entre asociaciones,
// por lo que se reserva a super_admin (no basta con usuarios.editar).
router.get('/:id/asociaciones', requierePermiso('usuarios.consultar'), UsuarioController.listarAsociaciones);
router.post('/:id/2fa/reset', requiereRol('super_admin'), UsuarioController.reiniciar2FA);
router.post('/:id/asociaciones', requiereRol('super_admin'), UsuarioController.agregarAsociacion);
router.delete('/:id/asociaciones/:asociacionId', requiereRol('super_admin'), UsuarioController.quitarAsociacion);

module.exports = router;
