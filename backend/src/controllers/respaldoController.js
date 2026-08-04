const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const RespaldoModel = require('../models/respaldoModel');

const DIRECTORIO_RESPALDOS = path.join(__dirname, '..', '..', 'backups');
if (!fs.existsSync(DIRECTORIO_RESPALDOS)) fs.mkdirSync(DIRECTORIO_RESPALDOS, { recursive: true });

function ejecutarPgDump(archivoDestino) {
  return new Promise((resolve, reject) => {
    execFile(
      'pg_dump',
      [process.env.DATABASE_URL, '-F', 'p', '-f', archivoDestino, '--no-owner', '--no-privileges'],
      { timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        return resolve();
      }
    );
  });
}

const RespaldoController = {
  /**
   * POST /api/respaldos — genera un nuevo respaldo completo de la base de datos.
   */
  async generar(req, res, next) {
    try {
      const nombreArchivo = `sigevac_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
      const rutaCompleta = path.join(DIRECTORIO_RESPALDOS, nombreArchivo);

      await ejecutarPgDump(rutaCompleta);

      const { size } = fs.statSync(rutaCompleta);
      const respaldo = await RespaldoModel.crear({
        archivoUrl: `/backups/${nombreArchivo}`,
        tamanoBytes: size,
        generadoPor: req.usuario.id,
      });

      return res.status(201).json({ respaldo });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/respaldos
   */
  async listar(req, res, next) {
    try {
      const respaldos = await RespaldoModel.listar();
      return res.json({ respaldos });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/respaldos/:id/descargar
   */
  async descargar(req, res, next) {
    try {
      const respaldo = await RespaldoModel.obtenerPorId(req.params.id);
      if (!respaldo) return res.status(404).json({ error: 'Respaldo no encontrado.' });

      const nombreArchivo = path.basename(respaldo.archivo_url);
      const rutaCompleta = path.join(DIRECTORIO_RESPALDOS, nombreArchivo);
      if (!fs.existsSync(rutaCompleta)) return res.status(404).json({ error: 'El archivo de respaldo ya no existe en disco.' });

      return res.download(rutaCompleta, nombreArchivo);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = RespaldoController;
