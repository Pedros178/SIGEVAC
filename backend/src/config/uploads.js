const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Directorio local de almacenamiento (Fase futura: reemplazar por S3/Cloud Storage
// manteniendo la misma interfaz — solo cambia dónde se guarda `url` en archivoModel).
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const TIPOS_PERMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const nombreUnico = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, nombreUnico);
  },
});

function filtroArchivo(req, file, cb) {
  if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF, PNG, JPG o WEBP.'));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: filtroArchivo,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { upload, UPLOADS_DIR };
