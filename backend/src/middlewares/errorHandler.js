/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  console.error('Error no controlado:', err);

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
