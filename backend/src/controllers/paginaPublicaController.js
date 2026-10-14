const ActividadModel = require('../models/actividadModel');
const VoluntarioModel = require('../models/voluntarioModel');
const { resolverAsociacionPublicaId } = require('../services/asociacionPublicaService');

// Fecha de fundación de la asociación. No cambia, así que no vale la pena
// una columna en BD para esto — pero calculamos "años de trabajo" a partir
// de aquí en vez de tener el número escrito a mano en el frontend, para
// que no haya que recordar actualizarlo cada aniversario.
const FECHA_FUNDACION = new Date('2013-01-07');

// Áreas de labor: es contenido editorial fijo (no varía por voluntario ni
// por asociación), así que se mantiene como lista estática en vez de una
// tabla de catálogo; aquí solo se expone el conteo para la cifra pública.
const TOTAL_AREAS_DE_LABOR = 30;

function calcularAniosDesde(fecha) {
  const hoy = new Date();
  let anios = hoy.getFullYear() - fecha.getFullYear();
  const aunNoCumpleAniversario = (
    hoy.getMonth() < fecha.getMonth()
    || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())
  );
  if (aunNoCumpleAniversario) anios -= 1;
  return anios;
}

const PaginaPublicaController = {
  /**
   * GET /api/publico/actividades
   * Sin autenticación. Devuelve hasta 6 próximas actividades no
   * canceladas, con únicamente los campos seguros para mostrar en la
   * página de inicio (nunca datos de voluntarios ni del responsable).
   */
  async actividadesProximas(req, res, next) {
    try {
      const asociacionId = await resolverAsociacionPublicaId();
      if (!asociacionId) return res.json({ actividades: [] });

      const actividades = await ActividadModel.listarProximasPublicas(asociacionId, 6);
      return res.json({ actividades });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/publico/estadisticas
   * Sin autenticación. Cifras agregadas para la sección "Cifras" del Home
   * público (años de trabajo, voluntarios activos, estados con presencia,
   * áreas de labor). Solo conteos, nunca datos de voluntarios individuales.
   */
  async estadisticas(req, res, next) {
    try {
      const asociacionId = await resolverAsociacionPublicaId();
      const base = {
        anios_trabajo: calcularAniosDesde(FECHA_FUNDACION),
        voluntarios_activos: 0,
        estados_con_presencia: 0,
        areas_de_labor: TOTAL_AREAS_DE_LABOR,
      };
      if (!asociacionId) return res.json(base);

      const { voluntarios_activos, estados_con_presencia } = await VoluntarioModel.estadisticasPublicas(asociacionId);
      return res.json({
        ...base,
        voluntarios_activos,
        estados_con_presencia,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = PaginaPublicaController;
