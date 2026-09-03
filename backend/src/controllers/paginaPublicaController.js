const ActividadModel = require('../models/actividadModel');
const AsociacionModel = require('../models/asociacionModel');

/**
 * Esta instalación de SIGEVAC está desplegada para UNA asociación (no es
 * un directorio multi-organización de cara al público, aunque el backend
 * sí soporte varias asociaciones internamente — ver Fase 7). La página de
 * inicio pública necesita saber de cuál mostrar las actividades próximas.
 *
 * Se resuelve así:
 *   1. Variable de entorno ASOCIACION_PUBLICA_ID, si está configurada.
 *   2. Si no, la asociación más antigua (la creada por el seed inicial).
 */
async function resolverAsociacionPublicaId() {
  if (process.env.ASOCIACION_PUBLICA_ID) return process.env.ASOCIACION_PUBLICA_ID;
  const asociaciones = await AsociacionModel.listar();
  return asociaciones[0]?.id || null;
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
};

module.exports = PaginaPublicaController;
