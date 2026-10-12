const CatalogoModel = require('../models/catalogoModel');

const PATRON_TIPO = /^[a-z][a-z0-9_]{0,79}$/;
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETIQUETA_MAX = 150;

const CatalogoController = {
  /**
   * GET /api/catalogos/:tipo  (público, solo lectura)
   * Listas de opciones para los formularios (tipo_sangre, parentesco, ...).
   * No contienen datos personales, por eso no exigen sesión (la solicitud
   * pública de voluntariado también las puede necesitar).
   */
  async listarPorTipo(req, res, next) {
    try {
      if (!PATRON_TIPO.test(req.params.tipo)) {
        return res.status(400).json({ error: 'Tipo de catálogo inválido.' });
      }
      return res.json({ tipo: req.params.tipo, opciones: await CatalogoModel.listarPorTipo(req.params.tipo) });
    } catch (err) { return next(err); }
  },

  // --- Administración (autenticado) ---

  async listarTodos(req, res, next) {
    try {
      return res.json({ catalogos: await CatalogoModel.listarTodos() });
    } catch (err) { return next(err); }
  },

  async crear(req, res, next) {
    try {
      const tipo = String(req.body.tipo || '').trim();
      const clave = String(req.body.clave || '').trim();
      const etiqueta = String(req.body.etiqueta || '').trim();
      const orden = req.body.orden === undefined ? 0 : Number(req.body.orden);
      if (!PATRON_TIPO.test(tipo)) {
        return res.status(400).json({ error: 'tipo debe usar minúsculas, números y guion bajo (p. ej. tipo_sangre).' });
      }
      if (!/^[a-z0-9_]{1,80}$/.test(clave)) {
        return res.status(400).json({ error: 'clave debe usar minúsculas, números y guion bajo (máx. 80 caracteres).' });
      }
      if (!etiqueta || etiqueta.length > ETIQUETA_MAX) {
        return res.status(400).json({ error: `etiqueta es obligatoria (máximo ${ETIQUETA_MAX} caracteres).` });
      }
      if (!Number.isInteger(orden) || orden < 0 || orden > 32000) {
        return res.status(400).json({ error: 'orden debe ser un entero entre 0 y 32000.' });
      }
      const opcion = await CatalogoModel.crear({ tipo, clave, etiqueta, orden });
      return res.status(201).json({ opcion });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una opción con ese tipo y clave.' });
      return next(err);
    }
  },

  async actualizar(req, res, next) {
    try {
      if (!PATRON_UUID.test(req.params.id)) return res.status(404).json({ error: 'Opción no encontrada.' });
      const etiqueta = req.body.etiqueta === undefined ? undefined : String(req.body.etiqueta).trim();
      const orden = req.body.orden === undefined ? undefined : Number(req.body.orden);
      if (etiqueta !== undefined && (!etiqueta || etiqueta.length > ETIQUETA_MAX)) {
        return res.status(400).json({ error: `etiqueta no puede estar vacía ni pasar de ${ETIQUETA_MAX} caracteres.` });
      }
      if (orden !== undefined && (!Number.isInteger(orden) || orden < 0 || orden > 32000)) {
        return res.status(400).json({ error: 'orden debe ser un entero entre 0 y 32000.' });
      }
      const opcion = await CatalogoModel.actualizar(req.params.id, { etiqueta, orden });
      if (!opcion) return res.status(404).json({ error: 'Opción no encontrada.' });
      return res.json({ opcion });
    } catch (err) { return next(err); }
  },

  async eliminar(req, res, next) {
    try {
      if (!PATRON_UUID.test(req.params.id)) return res.status(404).json({ error: 'Opción no encontrada.' });
      const eliminada = await CatalogoModel.eliminar(req.params.id);
      if (!eliminada) return res.status(404).json({ error: 'Opción no encontrada.' });
      return res.json({ mensaje: 'Opción eliminada.' });
    } catch (err) { return next(err); }
  },
};

module.exports = CatalogoController;
