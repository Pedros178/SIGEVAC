/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  console.error('Error no controlado:', err);

  // Errores de Multer (Módulo 8 - gestor de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido (10 MB).' });
  }
  if (err.message?.includes('Tipo de archivo no permitido')) {
    return res.status(415).json({ error: err.message });
  }

  // Violación de restricción única de PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: 'El registro ya existe (violación de unicidad).' });
  }

  // Violación de llave foránea
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia inválida a un registro relacionado.' });
  }

  const status = err.status || 500;
  const mensaje = err.status ? err.message : 'Ocurrió un error interno en el servidor.';
  return res.status(status).json({ error: mensaje });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
