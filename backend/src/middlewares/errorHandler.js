/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {

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

  // Datos con formato inválido para el tipo de columna (uuid mal formado,
  // texto demasiado largo, fecha/número ilegibles, nulo en columna obligatoria,
  // CHECK incumplido): son errores del cliente, no del servidor.
  const CODIGOS_DATO_INVALIDO = {
    '22021': 'Alguno de los textos enviados contiene caracteres no permitidos.',
    '22P02': 'Alguno de los datos o identificadores enviados tiene un formato inválido.',
    '22001': 'Alguno de los textos enviados excede la longitud permitida.',
    '22003': 'Alguno de los números enviados está fuera del rango permitido.',
    '22007': 'Alguna de las fechas enviadas no es válida.',
    '22008': 'Alguna de las fechas enviadas no es válida.',
    '23502': 'Falta un dato obligatorio.',
    '23514': 'Alguno de los datos enviados no cumple las reglas de validación.',
  };
  if (CODIGOS_DATO_INVALIDO[err.code]) {
    return res.status(400).json({ error: CODIGOS_DATO_INVALIDO[err.code] });
  }

  // Errores del parser de body (JSON mal formado, demasiado grande): 4xx con
  // mensaje genérico en vez de filtrar el texto interno del parser.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
  }

  console.error('Error no controlado:', err);
  const status = err.status || 500;
  const mensaje = err.status ? err.message : 'Ocurrió un error interno en el servidor.';
  return res.status(status).json({ error: mensaje });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
