const ActividadModel = require('../models/actividadModel');
const { leerPaginacion } = require('../utils/paginacion');
const { almacenamientoRemoto, guardarArchivo, obtenerArchivo } = require('../config/storage');
const ParticipacionModel = require('../models/participacionModel');
const { notificarNuevaActividad } = require('../services/notificacionService');

const ActividadController = {
  async listar(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      const { limit, offset } = leerPaginacion(req.query);
      const actividades = await ActividadModel.listar({
        asociacionId: req.usuario.asociacionId, desde, hasta, limit, offset,
      });
      return res.json({ actividades });
    } catch (err) {
      return next(err);
    }
  },

  async crear(req, res, next) {
    try {
      const { nombre, fecha, horaInicio, horaFin, estado, lugar, latitud, longitud, responsableId, descripcion, cupo } = req.body;
      if (!nombre || !fecha) {
        return res.status(400).json({ error: 'nombre y fecha son obligatorios.' });
      }
      const errorCoordenadas = validarCoordenadas(latitud, longitud);
      if (errorCoordenadas) return res.status(400).json({ error: errorCoordenadas });

      const actividad = await ActividadModel.crear({
        asociacionId: req.usuario.asociacionId, nombre, fecha, horaInicio, horaFin, estado, lugar, latitud, longitud, responsableId, descripcion, cupo,
      });
      // notificarNuevaActividad ya maneja sus propios errores internamente
      // (nunca lanza), así que esperarla no puede tumbar esta respuesta;
      // pero si no se espera, el cliente puede consultar /notificaciones
      // antes de que las filas existan (condición de carrera real,
      // confirmada porque hacía fallar 2 pruebas de la propia suite).
      await notificarNuevaActividad({ actividad, asociacionId: req.usuario.asociacionId });
      return res.status(201).json({ actividad });
    } catch (err) {
      return next(err);
    }
  },

  async obtener(req, res, next) {
    try {
      const actividad = await ActividadModel.obtenerPorId(req.params.id);
      if (!actividad) return res.status(404).json({ error: 'Actividad no encontrada.' });
      const [participantes, evidencias] = await Promise.all([
        ParticipacionModel.listarPorActividad(actividad.id),
        ActividadModel.listarEvidencias(actividad.id),
      ]);
      return res.json({ actividad: { ...actividad, participantes, evidencias } });
    } catch (err) {
      return next(err);
    }
  },

  async actualizar(req, res, next) {
    try {
      const errorCoordenadas = validarCoordenadas(req.body.latitud, req.body.longitud);
      if (errorCoordenadas) return res.status(400).json({ error: errorCoordenadas });

      const actividad = await ActividadModel.actualizar(req.params.id, req.body);
      if (!actividad) return res.status(404).json({ error: 'Actividad no encontrada.' });
      return res.json({ actividad });
    } catch (err) {
      return next(err);
    }
  },

  async agregarEvidencia(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "evidencia").' });
      }
      const actividad = await ActividadModel.obtenerPorId(req.params.id);
      if (!actividad) {
        require('fs').unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Actividad no encontrada.' });
      }
      const referencia = await guardarArchivo({
        rutaLocal: req.file.path,
        ruta: `actividades/${actividad.id}/evidencia-${req.file.filename}`,
        contentType: req.file.mimetype,
      });
      if (almacenamientoRemoto) require('fs').unlink(req.file.path, () => {});
      const evidencia = await ActividadModel.agregarEvidencia(req.params.id, {
        url: referencia,
        mimeType: req.file.mimetype,
        descripcion: req.body.descripcion,
      });
      return res.status(201).json({ evidencia });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/evidencias/:id
   * Sirve el contenido real de la foto (antes solo se podía subir, nunca
   * volver a ver: se recibía la lista pero no había forma de traer los
   * bytes de vuelta, ni local ni desde Supabase Storage).
   */
  async obtenerEvidencia(req, res, next) {
    try {
      const evidencia = await ActividadModel.obtenerEvidenciaPorId(req.params.id);
      if (!evidencia) return res.status(404).json({ error: 'Evidencia no encontrada.' });

      try {
        const contenido = await obtenerArchivo(evidencia.url);
        res.set('Content-Type', evidencia.mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'private, max-age=3600');
        return res.send(contenido);
      } catch {
        return res.status(404).json({ error: 'La evidencia ya no existe en el almacenamiento.' });
      }
    } catch (err) {
      return next(err);
    }
  },
};

/**
 * Ambas coordenadas son opcionales, pero si se manda una se debe mandar
 * la otra, y deben caer dentro de un rango geográfico válido — así se
 * evita guardar basura (p.ej. 0,0 por un campo mal parseado) que luego
 * se dibujaría en el mapa en medio del océano.
 */
function validarCoordenadas(latitud, longitud) {
  const tieneLat = latitud !== undefined && latitud !== null && latitud !== '';
  const tieneLng = longitud !== undefined && longitud !== null && longitud !== '';
  if (!tieneLat && !tieneLng) return null;
  if (tieneLat !== tieneLng) return 'Debes proporcionar latitud y longitud juntas.';
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return 'Latitud y longitud deben ser numéricas.';
  if (lat < -90 || lat > 90) return 'La latitud debe estar entre -90 y 90.';
  if (lng < -180 || lng > 180) return 'La longitud debe estar entre -180 y 180.';
  return null;
}

module.exports = ActividadController;
