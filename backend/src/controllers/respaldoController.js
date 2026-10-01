const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const RespaldoModel = require('../models/respaldoModel');
const { almacenamientoRemoto, guardarArchivo, obtenerArchivo, eliminarArchivo, esReferenciaRemota } = require('../config/storage');
const { contentDisposition } = require('../utils/contentDisposition');

const DIRECTORIO_RESPALDOS = path.join(__dirname, '..', '..', 'backups');
if (!fs.existsSync(DIRECTORIO_RESPALDOS)) fs.mkdirSync(DIRECTORIO_RESPALDOS, { recursive: true });

const MAXIMO_RESPALDOS = Math.max(parseInt(process.env.RESPALDOS_MAXIMO || '10', 10) || 10, 1);

/** Descompone DATABASE_URL en variables PG*: pg_dump no admite una URI en PGDATABASE. */
function variablesPg(url = process.env.DATABASE_URL) {
  const u = new URL(url);
  const env = {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
  const sslmode = u.searchParams.get('sslmode') || (process.env.DB_SSL === 'true' ? 'require' : null);
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

function ejecutarPgDump(archivoDestino) {
  return new Promise((resolve, reject) => {
    // Las credenciales viajan por VARIABLES DE ENTORNO y no como argumento:
    // los argumentos son visibles para cualquier usuario del servidor con `ps`.
    execFile(
      'pg_dump',
      ['-F', 'p', '-f', archivoDestino, '--no-owner', '--no-privileges'],
      { timeout: 120_000, env: { ...process.env, ...variablesPg() } },
      (error, _stdout, stderr) => {
        if (error) {
          const mensaje = error.code === 'ENOENT'
            ? 'pg_dump no está instalado o no está disponible en el PATH del servidor.'
            : 'No se pudo generar el respaldo (revisa los logs del servidor).';
          if (error.code !== 'ENOENT') console.error('pg_dump falló:', (stderr || error.message).replace(/postgres(ql)?:\/\/[^\s]+/gi, '[url-oculta]'));
          return reject(Object.assign(new Error(mensaje), { status: error.code === 'ENOENT' ? 503 : 500 }));
        }
        return resolve();
      }
    );
  });
}

/** Conserva solo los N respaldos más recientes (evita llenar el disco sin límite). */
async function rotarRespaldos() {
  const todos = await RespaldoModel.listar(1000);
  for (const viejo of todos.slice(MAXIMO_RESPALDOS)) {
    try {
      if (esReferenciaRemota(viejo.archivo_url)) await eliminarArchivo(viejo.archivo_url);
      else fs.unlinkSync(path.join(DIRECTORIO_RESPALDOS, path.basename(viejo.archivo_url)));
    } catch { /* si el archivo ya no existe, igual se limpia el registro */ }
    await RespaldoModel.eliminar(viejo.id);
  }
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
      let archivoUrl = `/backups/${nombreArchivo}`;
      if (almacenamientoRemoto) {
        // En plataformas con disco efímero (Render) el archivo local se perdería
        // en el próximo reinicio: se sube a almacenamiento persistente.
        archivoUrl = await guardarArchivo({ rutaLocal: rutaCompleta, ruta: `respaldos/${nombreArchivo}`, contentType: 'application/sql' });
        fs.unlinkSync(rutaCompleta);
      }
      const respaldo = await RespaldoModel.crear({
        archivoUrl,
        tamanoBytes: size,
        generadoPor: req.usuario.id,
      });

      await rotarRespaldos();
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
      if (esReferenciaRemota(respaldo.archivo_url)) {
        const contenido = await obtenerArchivo(respaldo.archivo_url);
        res.set({ 'Content-Type': 'application/sql', 'Content-Disposition': contentDisposition('attachment', nombreArchivo) });
        return res.send(contenido);
      }
      const rutaCompleta = path.join(DIRECTORIO_RESPALDOS, nombreArchivo);
      if (!fs.existsSync(rutaCompleta)) return res.status(404).json({ error: 'El archivo de respaldo ya no existe en disco.' });

      return res.download(rutaCompleta, nombreArchivo);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = RespaldoController;
