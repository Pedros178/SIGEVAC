const ParticipacionModel = require('../models/participacionModel');
const AsistenciaModel = require('../models/asistenciaModel');
const { evaluarInsignias } = require('../services/gamificacionService');

const ParticipacionController = {
  /**
   * POST /api/actividades/:actividadId/participaciones
   */
  async inscribir(req, res, next) {
    try {
      const { voluntarioId } = req.body;
      if (!voluntarioId) return res.status(400).json({ error: 'voluntarioId es obligatorio.' });
      const { participacion, yaExistia } = await ParticipacionModel.inscribir(req.params.actividadId, voluntarioId);
      if (yaExistia) {
        return res.status(409).json({ error: 'Este voluntario ya está inscrito en esta actividad.', participacion });
      }
      return res.status(201).json({ participacion });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/actividades/:actividadId/participaciones
   */
  async listarPorActividad(req, res, next) {
    try {
      const participantes = await ParticipacionModel.listarPorActividad(req.params.actividadId);
      return res.json({ participantes });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:voluntarioId/participaciones
   */
  async listarPorVoluntario(req, res, next) {
    try {
      const participaciones = await ParticipacionModel.listarPorVoluntario(req.params.voluntarioId);
      return res.json({ participaciones });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * DELETE /api/participaciones/:id
   */
  async cancelar(req, res, next) {
    try {
      await ParticipacionModel.cancelar(req.params.id);
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/participaciones/:id/entrada
   * body.horaCliente (opcional): ISO 8601, usado por el modo offline del
   * frontend para conservar la hora real del evento al sincronizar.
   */
  async registrarEntrada(req, res, next) {
    try {
      const errorHora = validarHoraCliente(req.body.horaCliente);
      if (errorHora) return res.status(400).json({ error: errorHora });

      const asistencia = await AsistenciaModel.registrarEntrada(req.params.id, req.body.horaCliente || null);
      return res.json({ asistencia });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/participaciones/:id/salida
   * body.horaCliente (opcional): igual que en registrarEntrada.
   */
  async registrarSalida(req, res, next) {
    try {
      const errorHora = validarHoraCliente(req.body.horaCliente);
      if (errorHora) return res.status(400).json({ error: errorHora });

      const participacion = await ParticipacionModel.obtenerPorId(req.params.id);
      if (!participacion) return res.status(404).json({ error: 'Participación no encontrada.' });

      const asistencia = await AsistenciaModel.registrarSalida(
        req.params.id,
        participacion.voluntario_id,
        req.body.observaciones,
        req.body.horaCliente || null
      );

      // evaluarInsignias es best-effort (nunca lanza): las horas y la
      // actividad ya quedaron registradas, así que un fallo aquí no debe
      // tumbar la respuesta de la salida.
      const nuevasInsignias = await evaluarInsignias(participacion.voluntario_id);

      return res.json({ asistencia, nuevas_insignias: nuevasInsignias });
    } catch (err) {
      return next(err);
    }
  },
};

/**
 * horaCliente viaja desde el modo offline del frontend (dispositivo sin
 * conexión que registra la hora real y la sincroniza después). Se acota a
 * una ventana razonable para que el mecanismo de "conservar la hora real"
 * no se pueda usar para inflar o falsificar horas de servicio: máximo 7
 * días hacia atrás (más que suficiente para cualquier corte de conexión
 * realista) y una pequeña tolerancia hacia adelante por diferencia de
 * reloj entre dispositivos.
 */
function validarHoraCliente(horaCliente) {
  if (!horaCliente) return null;
  const fecha = new Date(horaCliente);
  if (Number.isNaN(fecha.getTime())) return 'horaCliente debe ser una fecha ISO 8601 válida.';

  const ahora = Date.now();
  const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
  const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000; // 5 minutos de tolerancia por reloj desincronizado

  if (fecha.getTime() < ahora - SIETE_DIAS_MS) {
    return 'horaCliente no puede ser de hace más de 7 días.';
  }
  if (fecha.getTime() > ahora + TOLERANCIA_FUTURO_MS) {
    return 'horaCliente no puede estar en el futuro.';
  }
  return null;
}

module.exports = ParticipacionController;
