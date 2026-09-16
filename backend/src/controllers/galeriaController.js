const fs = require('fs/promises');
const GaleriaModel = require('../models/galeriaModel');
const { guardarArchivo, obtenerArchivo, eliminarArchivo, almacenamientoRemoto } = require('../config/storage');
const { resolverAsociacionPublicaId } = require('../services/asociacionPublicaService');
const { query } = require('../config/database');

const LEYENDA_MAX = 120;
const ALT_MAX = 200;

const GaleriaController = {
  // --- Administración (autenticado) ---

  async listar(req, res, next) {
    try {
      return res.json({ fotos: await GaleriaModel.listar(req.usuario.asociacionId) });
    } catch (err) { return next(err); }
  },

  async subir(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "imagen").' });
      }
      if (!req.file.mimetype.startsWith('image/')) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'El archivo debe ser una imagen (PNG, JPG o WEBP).' });
      }

      const leyenda = (req.body.leyenda || '').trim();
      const textoAlternativo = (req.body.texto_alternativo || req.body.textoAlternativo || '').trim();
      if (!leyenda || !textoAlternativo) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'leyenda y texto_alternativo son obligatorios (el texto alternativo describe la foto para lectores de pantalla).' });
      }
      if (leyenda.length > LEYENDA_MAX || textoAlternativo.length > ALT_MAX) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: `leyenda debe tener máximo ${LEYENDA_MAX} caracteres y texto_alternativo máximo ${ALT_MAX}.` });
      }

      const vigenteHasta = (req.body.vigente_hasta || req.body.vigenteHasta || '').trim();

      const referencia = await guardarArchivo({
        rutaLocal: req.file.path,
        ruta: `galeria/${req.usuario.asociacionId}/${req.file.filename}`,
        contentType: req.file.mimetype,
      });
      if (almacenamientoRemoto) await fs.unlink(req.file.path).catch(() => {});

      const foto = await GaleriaModel.crear({
        asociacionId: req.usuario.asociacionId,
        url: referencia,
        mimeType: req.file.mimetype,
        textoAlternativo,
        leyenda,
        subidaPor: req.usuario.id,
        vigenteHasta: vigenteHasta || null,
      });
      return res.status(201).json({ foto });
    } catch (err) { return next(err); }
  },

  async actualizar(req, res, next) {
    try {
      const { leyenda, texto_alternativo: textoAlternativo, orden, publicada, vigente_hasta: vigenteHasta } = req.body;
      if (leyenda !== undefined && (!leyenda.trim() || leyenda.length > LEYENDA_MAX)) {
        return res.status(400).json({ error: `leyenda no puede estar vacía y debe tener máximo ${LEYENDA_MAX} caracteres.` });
      }
      if (textoAlternativo !== undefined && (!textoAlternativo.trim() || textoAlternativo.length > ALT_MAX)) {
        return res.status(400).json({ error: `texto_alternativo no puede estar vacío y debe tener máximo ${ALT_MAX} caracteres.` });
      }
      const foto = await GaleriaModel.actualizar(req.params.id, req.usuario.asociacionId, {
        leyenda: leyenda?.trim(),
        textoAlternativo: textoAlternativo?.trim(),
        orden: orden === undefined ? undefined : Number(orden),
        publicada,
        // '' (del <input type="date">) significa "quitar vigencia" → null.
        vigenteHasta: vigenteHasta === undefined ? undefined : (vigenteHasta || null),
      });
      if (!foto) return res.status(404).json({ error: 'Foto no encontrada.' });
      return res.json({ foto });
    } catch (err) { return next(err); }
  },

  async eliminar(req, res, next) {
    try {
      const foto = await GaleriaModel.eliminar(req.params.id, req.usuario.asociacionId);
      if (!foto) return res.status(404).json({ error: 'Foto no encontrada.' });
      await eliminarArchivo(foto.url);
      return res.json({ mensaje: 'Foto eliminada.' });
    } catch (err) { return next(err); }
  },

  /**
   * GET /api/galeria/:id/imagen (autenticado)
   * A diferencia de la versión pública, esta sirve la foto sin importar
   * si está publicada u oculta — el panel de Administración necesita ver
   * ambas para poder decidir si la republica.
   */
  async imagen(req, res, next) {
    try {
      const foto = await GaleriaModel.obtenerPorId(req.params.id, req.usuario.asociacionId);
      if (!foto) return res.status(404).json({ error: 'Foto no encontrada.' });
      try {
        const contenido = await obtenerArchivo(foto.url);
        res.set('Content-Type', foto.mime_type || 'image/jpeg');
        res.set('Cache-Control', 'private, max-age=3600');
        return res.send(contenido);
      } catch {
        return res.status(404).json({ error: 'La imagen ya no existe en el almacenamiento.' });
      }
    } catch (err) { return next(err); }
  },

  // --- Público (sin autenticación, para el Home) ---

  async listarPublica(req, res, next) {
    try {
      const asociacionId = await resolverAsociacionPublicaId();
      if (!asociacionId) return res.json({ fotos: [] });
      const fotos = await GaleriaModel.listarPublica(asociacionId);
      return res.json({
        fotos: fotos.map((f) => ({
          id: f.id,
          alt: f.texto_alternativo,
          caption: f.leyenda,
          // El navegador pide la imagen real a este endpoint público, que
          // funciona igual con almacenamiento local o remoto (Supabase).
          // Sin el prefijo /api: el frontend antepone la baseURL de su
          // cliente axios (que ya incluye /api), así funciona igual en
          // dev (proxy a localhost:4000) y en producción (mismo dominio
          // detrás de un reverse proxy, o dominios distintos).
          src: `/publico/galeria/${f.id}/imagen`,
        })),
      });
    } catch (err) { return next(err); }
  },

  async imagenPublica(req, res, next) {
    try {
      const asociacionId = await resolverAsociacionPublicaId();
      if (!asociacionId) return res.status(404).end();

      const { rows } = await query(
        `SELECT url, mime_type FROM galeria_publica
         WHERE id = $1 AND asociacion_id = $2 AND publicada = true
           AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)`,
        [req.params.id, asociacionId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Foto no encontrada.' });

      try {
        const contenido = await obtenerArchivo(rows[0].url);
        res.set('Content-Type', rows[0].mime_type || 'image/jpeg');
        // Las fotos de la galería casi no cambian: se puede cachear
        // agresivamente en el navegador/CDN, a diferencia de datos como
        // /publico/estadisticas que sí cambian seguido.
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(contenido);
      } catch {
        return res.status(404).json({ error: 'La imagen ya no existe en el almacenamiento.' });
      }
    } catch (err) { return next(err); }
  },
};

module.exports = GaleriaController;
