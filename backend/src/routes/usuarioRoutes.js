const express = require('express');
const UsuarioController = require('../controllers/usuarioController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();

router.use(autenticar);

router.get('/roles/disponibles', UsuarioController.listarRoles);
router.get('/', requierePermiso('usuarios.consultar'), UsuarioController.listar);
router.get('/:id', requierePermiso('usuarios.consultar'), UsuarioController.obtener);
router.post('/', requierePermiso('usuarios.crear'), UsuarioController.crear);
router.put('/:id', requierePermiso('usuarios.editar'), UsuarioController.actualizar);

module.exports = router;
