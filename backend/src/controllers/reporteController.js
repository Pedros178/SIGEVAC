const ReporteModel = require('../models/reporteModel');
const { aCsv, aXlsx, aPdf } = require('../utils/exportadores');

const GENERADORES = {
  'voluntarios-activos': ReporteModel.voluntariosActivos,
  'voluntarios-inactivos': ReporteModel.voluntariosInactivos,
  'expedientes-completos': ReporteModel.expedientesCompletos,
  'expedientes-pendientes': ReporteModel.expedientesPendientes,
  'horas-acumuladas': ReporteModel.horasAcumuladas,
  'participacion-por-actividad': ReporteModel.participacionPorActividad,
  'documentos-faltantes': ReporteModel.documentosFaltantes,
  'menores': ReporteModel.menores,
  'mayores': ReporteModel.mayores,
  'voluntarios-por-municipio': ReporteModel.voluntariosPorMunicipio,
  'voluntarios-en-riesgo': ReporteModel.voluntariosEnRiesgo,
};

const ReporteController = {
  /**
   * GET /api/reportes/tipos — catálogo de reportes disponibles, para poblar el selector del frontend
   */
  listarTipos(req, res) {
    return res.json({ tipos: Object.keys(GENERADORES) });
  },

  /**
   * GET /api/reportes/:tipo?formato=json|csv|xlsx|pdf
   */
  async generar(req, res, next) {
    try {
      const generador = GENERADORES[req.params.tipo];
      if (!generador) {
        return res.status(404).json({ error: `Reporte "${req.params.tipo}" no existe.`, disponibles: Object.keys(GENERADORES) });
      }

      const reporte = await generador(req.usuario.asociacionId);
      const formato = (req.query.formato || 'json').toLowerCase();
      const nombreArchivo = `sigevac_${req.params.tipo}_${new Date().toISOString().slice(0, 10)}`;

      if (formato === 'json') {
        return res.json(reporte);
      }
      if (formato === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.csv"`);
        return res.send(aCsv(reporte));
      }
      if (formato === 'xlsx') {
        const buffer = await aXlsx(reporte);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
        return res.send(buffer);
      }
      if (formato === 'pdf') {
        const buffer = await aPdf(reporte);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
        return res.send(buffer);
      }
      return res.status(400).json({ error: 'Formato no soportado. Usa json, csv, xlsx o pdf.' });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ReporteController;
