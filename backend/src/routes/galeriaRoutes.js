const express = require('express');
const GaleriaController = require('../controllers/galeriaController');
const { autenticar } = require('../middlewares/auth');
const { requierePermiso } = require('../middlewares/permisos');
const { upload } = require('../config/uploads');
const { verificarContenidoArchivo } = require('../middlewares/validarArchivo');

const router = express.Router();
router.use(autenticar);

router.get('/', requierePermiso('galeria.consultar'), GaleriaController.listar);
router.get('/:id/imagen', requierePermiso('galeria.consultar'), GaleriaController.imagen);
router.post(
  '/',
  requierePermiso('galeria.gestionar'),
  upload.single('imagen'),
  verificarContenidoArchivo,
  GaleriaController.subir
);
router.put('/:id', requierePermiso('galeria.gestionar'), GaleriaController.actualizar);
router.delete('/:id', requierePermiso('galeria.gestionar'), GaleriaController.eliminar);

module.exports = router;
