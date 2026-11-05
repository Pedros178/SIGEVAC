const PrivacidadModel = require('../models/privacidadModel');
const { eliminarArchivo } = require('../config/storage');
const { esUuid } = require('../utils/identificadores');
const { query } = require('../config/database');
const { longitudValida } = require('../utils/validadores');

const MEDIOS = ['presencial', 'portal', 'documento_firmado', 'otro'];
const TIPOS_ARCO = ['acceso', 'rectificacion', 'cancelacion', 'oposicion'];
const ESTADOS_ARCO = ['recibida', 'en_proceso', 'atendida', 'rechazada'];

const PrivacidadController = {
  /** POST /api/privacidad/voluntarios/:id/consentimientos */
  async registrarConsentimiento(req, res, next) {
    try {
      const { versionAviso, finalidadesSecundarias, medio } = req.body;
      if (typeof versionAviso !== 'string' || !versionAviso.trim() || versionAviso.length > 30) {
        return res.status(400).json({ error: 'versionAviso es obligatoria (texto de hasta 30 caracteres, p. ej. "2026-1").' });
      }
      if (medio !== undefined && !MEDIOS.includes(medio)) return res.status(400).json({ error: `medio debe ser uno de: ${MEDIOS.join(', ')}.` });
      if (finalidadesSecundarias !== undefined && typeof finalidadesSecundarias !== 'boolean') {
        return res.status(400).json({ error: 'finalidadesSecundarias debe ser verdadero o falso.' });
      }
      const consentimiento = await PrivacidadModel.registrarConsentimiento({
        asociacionId: req.usuario.asociacionId, voluntarioId: req.params.id, versionAviso: versionAviso.trim(),
        finalidadesSecundarias, medio, usuarioId: req.usuario.id,
      });
      return res.status(201).json({ consentimiento });
    } catch (err) { return next(err); }
  },

  /** GET /api/privacidad/voluntarios/:id/consentimientos */
  async listarConsentimientos(req, res, next) {
    try { return res.json({ consentimientos: await PrivacidadModel.listarConsentimientos(req.params.id) }); } catch (err) { return next(err); }
  },

  /** PATCH /api/privacidad/voluntarios/:id/consentimientos/:consentimientoId/revocar */
  async revocarConsentimiento(req, res, next) {
    try {
      if (!esUuid(req.params.consentimientoId)) return res.status(400).json({ error: 'Identificador inválido.' });
      const consentimiento = await PrivacidadModel.revocarConsentimiento(req.params.consentimientoId, req.params.id);
      if (!consentimiento) return res.status(404).json({ error: 'Consentimiento no encontrado o ya revocado.' });
      return res.json({ consentimiento });
    } catch (err) { return next(err); }
  },

  /** GET /api/privacidad/voluntarios/:id/datos-personales — derecho de acceso / portabilidad (JSON). */
  async exportarDatos(req, res, next) {
    try {
      const datos = await PrivacidadModel.exportarDatos(req.params.id);
      if (!datos) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      res.set('Cache-Control', 'no-store'); // contiene datos personales y de salud: que nada lo guarde en caché
      if (req.query.descargar === '1') res.set('Content-Disposition', `attachment; filename="datos-personales-${req.params.id}.json"`);
      return res.json(datos);
    } catch (err) { return next(err); }
  },

  /** POST /api/privacidad/voluntarios/:id/anonimizar — derecho de cancelación. Irreversible. */
  async anonimizar(req, res, next) {
    try {
      if (req.body.confirmar !== true) {
        return res.status(400).json({ error: 'Esta acción es irreversible. Envía { "confirmar": true, "motivo": "..." } para continuar.' });
      }
      if (typeof req.body.motivo !== 'string' || !req.body.motivo.trim() || !longitudValida(req.body.motivo, 500)) {
        return res.status(400).json({ error: 'El motivo es obligatorio (hasta 500 caracteres).' });
      }
      const resultado = await PrivacidadModel.anonimizar(req.params.id, req.usuario.asociacionId);
      if (resultado.estado === 'no_encontrado') return res.status(404).json({ error: 'Voluntario no encontrado.' });
      if (resultado.estado === 'ya_anonimizado') return res.status(409).json({ error: 'Este voluntario ya fue anonimizado.' });

      // Ya confirmada la transacción: se borran los archivos (foto, documentos, credencial). Si alguno falla, se avisa.
      const fallidos = [];
      for (const url of resultado.archivos) {
        try { await eliminarArchivo(url); } catch (err) { console.error('[privacidad] No se pudo eliminar un archivo:', err.message); fallidos.push(url); }
      }
      return res.json({
        mensaje: 'Datos personales eliminados. Solo se conservan estadísticas sin identificar a la persona.',
        archivos_eliminados: resultado.archivos.length - fallidos.length,
        archivos_con_error: fallidos.length,
      });
    } catch (err) { return next(err); }
  },

  /** GET /api/privacidad/retencion/candidatos?anios=5 — bajas antiguas con datos personales aún guardados. */
  async candidatosARetencion(req, res, next) {
    try {
      const anios = req.query.anios === undefined ? 5 : Number(req.query.anios);
      if (!Number.isInteger(anios) || anios < 1 || anios > 50) return res.status(400).json({ error: 'anios debe ser un entero entre 1 y 50.' });
      const candidatos = await PrivacidadModel.candidatosARetencion(req.usuario.asociacionId, anios);
      return res.json({ anios, total: candidatos.length, candidatos });
    } catch (err) { return next(err); }
  },

  // ---------- Solicitudes ARCO ----------
  async crearSolicitudArco(req, res, next) {
    try {
      const { voluntarioId, tipo, detalle } = req.body;
      if (!TIPOS_ARCO.includes(tipo)) return res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_ARCO.join(', ')}.` });
      if (detalle !== undefined && (typeof detalle !== 'string' || !longitudValida(detalle, 2000))) return res.status(400).json({ error: 'detalle excede 2000 caracteres.' });
      if (voluntarioId !== undefined && voluntarioId !== null) {
        if (!esUuid(voluntarioId)) return res.status(400).json({ error: 'voluntarioId inválido.' });
        const { rows } = await query('SELECT 1 FROM voluntarios WHERE id = $1 AND asociacion_id = $2', [voluntarioId, req.usuario.asociacionId]);
        if (!rows[0]) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      }
      const solicitud = await PrivacidadModel.crearSolicitudArco({
        asociacionId: req.usuario.asociacionId, voluntarioId, tipo, detalle, usuarioId: req.usuario.id,
      });
      return res.status(201).json({ solicitud });
    } catch (err) { return next(err); }
  },

  async listarSolicitudesArco(req, res, next) {
    try {
      if (req.query.estado !== undefined && !ESTADOS_ARCO.includes(req.query.estado)) return res.status(400).json({ error: 'estado inválido.' });
      return res.json({ solicitudes: await PrivacidadModel.listarSolicitudesArco(req.usuario.asociacionId, req.query.estado) });
    } catch (err) { return next(err); }
  },

  async resolverSolicitudArco(req, res, next) {
    try {
      if (!esUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
      const { estado, resolucion } = req.body;
      if (!ESTADOS_ARCO.includes(estado)) return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_ARCO.join(', ')}.` });
      if (resolucion !== undefined && (typeof resolucion !== 'string' || !longitudValida(resolucion, 2000))) return res.status(400).json({ error: 'resolucion excede 2000 caracteres.' });
      const solicitud = await PrivacidadModel.resolverSolicitudArco(req.params.id, req.usuario.asociacionId, { estado, resolucion, usuarioId: req.usuario.id });
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      return res.json({ solicitud });
    } catch (err) { return next(err); }
  },
};

module.exports = PrivacidadController;
