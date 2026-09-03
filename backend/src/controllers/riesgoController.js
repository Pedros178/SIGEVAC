const RiesgoModel = require('../models/riesgoModel');
const { calcularRiesgo } = require('../services/riesgoService');

const RiesgoController = {
  /** GET /api/voluntarios/:voluntarioId/riesgo — detalle con desglose, para la ficha del voluntario. */
  async obtenerPorVoluntario(req, res, next) {
    try {
      const componentes = await RiesgoModel.obtenerComponentes(req.params.voluntarioId);
      if (!componentes) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const resultado = calcularRiesgo(componentes);
      return res.json({ ...resultado, voluntario: { id: componentes.voluntarioId, nombre: componentes.nombreCompleto, folio: componentes.folio } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/riesgo/resumen — listado de todos los voluntarios
   * activos con su puntaje, para el panel de "voluntarios en riesgo".
   * Ordenado de mayor a menor riesgo.
   */
  async resumenAsociacion(req, res, next) {
    try {
      const todos = await RiesgoModel.obtenerComponentesPorAsociacion(req.usuario.asociacionId);
      const conRiesgo = todos
        .map((componentes) => {
          const resultado = calcularRiesgo(componentes);
          return {
            voluntario_id: componentes.voluntarioId,
            nombre: componentes.nombreCompleto,
            folio: componentes.folio,
            puntaje: resultado.puntaje,
            nivel: resultado.nivel,
            nivel_etiqueta: resultado.nivel_etiqueta,
            factor_principal: resultado.desglose[0]?.etiqueta || null,
          };
        })
        .sort((a, b) => b.puntaje - a.puntaje);

      const resumen = {
        alto: conRiesgo.filter((v) => v.nivel === 'alto').length,
        medio: conRiesgo.filter((v) => v.nivel === 'medio').length,
        bajo: conRiesgo.filter((v) => v.nivel === 'bajo').length,
      };

      return res.json({ voluntarios: conRiesgo, resumen });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = RiesgoController;
