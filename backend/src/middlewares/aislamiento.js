const { query } = require('../config/database');

function protegerPorConsulta(sql, parametro = 'id') {
  return async (req, res, next) => {
    try {
      const { rows } = await query(sql, [req.params[parametro], req.usuario.asociacionId]);
      if (!rows[0]) return res.status(404).json({ error: 'Recurso no encontrado.' });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const voluntarioDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  'SELECT 1 FROM voluntarios WHERE id = $1 AND asociacion_id = $2', parametro
);

const documentoDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  `SELECT 1 FROM documentos d
   JOIN expedientes e ON e.id = d.expediente_id
   JOIN voluntarios v ON v.id = e.voluntario_id
   WHERE d.id = $1 AND v.asociacion_id = $2`, parametro
);

const archivoDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  `SELECT 1 FROM archivos a
   JOIN documentos d ON d.id = a.documento_id
   JOIN expedientes e ON e.id = d.expediente_id
   JOIN voluntarios v ON v.id = e.voluntario_id
   WHERE a.id = $1 AND v.asociacion_id = $2`, parametro
);

const actividadDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  'SELECT 1 FROM actividades WHERE id = $1 AND asociacion_id = $2', parametro
);

const participacionDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  `SELECT 1 FROM participaciones p
   JOIN actividades a ON a.id = p.actividad_id
   WHERE p.id = $1 AND a.asociacion_id = $2`, parametro
);

// Agregado junto con la corrección del bug de evidencias sin servir.
const evidenciaDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  `SELECT 1 FROM evidencias ev
   JOIN actividades a ON a.id = ev.actividad_id
   WHERE ev.id = $1 AND a.asociacion_id = $2`, parametro
);

// Módulo de inventario (Fase 8, ampliado): artículos y su fotos/préstamos
// anidados deben validarse contra la asociación del usuario autenticado.
const articuloDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  'SELECT 1 FROM inventario_articulos WHERE id = $1 AND asociacion_id = $2', parametro
);

const prestamoDeAsociacion = (parametro = 'id') => protegerPorConsulta(
  'SELECT 1 FROM inventario_prestamos WHERE id = $1 AND asociacion_id = $2', parametro
);

const fotoInventarioDeAsociacion = (parametro = 'fotoId') => protegerPorConsulta(
  `SELECT 1 FROM inventario_articulo_fotos f
   JOIN inventario_articulos a ON a.id = f.articulo_id
   WHERE f.id = $1 AND a.asociacion_id = $2`, parametro
);

module.exports = {
  voluntarioDeAsociacion,
  documentoDeAsociacion,
  archivoDeAsociacion,
  actividadDeAsociacion,
  participacionDeAsociacion,
  evidenciaDeAsociacion,
  articuloDeAsociacion,
  prestamoDeAsociacion,
  fotoInventarioDeAsociacion,
};