const fs = require('fs');
const { leerPaginacion } = require('../utils/paginacion');
const ExcelJS = require('exceljs');
const { getClient } = require('../config/database');
const VoluntarioModel = require('../models/voluntarioModel');
const TutorModel = require('../models/tutorModel');
const { ExpedienteModel } = require('../models/expedienteModel');
const { almacenamientoRemoto, guardarArchivo, eliminarArchivo, obtenerArchivo } = require('../config/storage');

const { esMenorDeEdad } = require('../utils/edad');
const { validarDatosVoluntario } = require('../utils/validarVoluntario');

const MAX_FILAS_IMPORTACION = 2000;

/** Convierte el valor de una celda (texto, número, fecha, fórmula, hipervínculo) a texto/fecha ISO. */
function valorDeCelda(valor) {
  if (valor === null || valor === undefined || valor === '') return undefined;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if (valor.richText) return valor.richText.map((t) => t.text).join('');
    if (valor.text !== undefined) return String(valor.text);
    if (valor.result !== undefined) return valorDeCelda(valor.result);
    return undefined;
  }
  return typeof valor === 'string' ? valor.trim() || undefined : String(valor);
}

const VoluntarioController = {
  /**
   * GET /api/voluntarios
   */
  async listar(req, res, next) {
    try {
      const { activo, busqueda, tipo } = req.query;
      const { limit, offset } = leerPaginacion(req.query);
      const voluntarios = await VoluntarioModel.listar({
        asociacionId: req.usuario.asociacionId,
        activo: activo === undefined ? null : activo === 'true',
        busqueda,
        tipo: Number.isInteger(Number(tipo)) && Number(tipo) > 0 ? Number(tipo) : null,
        limit,
        offset,
      });
      return res.json({ voluntarios });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:id
   */
  async obtener(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.params.id);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      const tipos = await VoluntarioModel.obtenerTipos(voluntario.id);
      const tutor = voluntario.es_menor_edad ? await TutorModel.obtenerPorVoluntario(voluntario.id) : null;
      const expediente = await ExpedienteModel.obtenerPorVoluntario(voluntario.id);

      return res.json({ voluntario: { ...voluntario, tipos, tutor, expediente } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/voluntarios
   * Registra un voluntario, crea su expediente digital automáticamente
   * (Módulo 7) y, si es menor de edad, exige los datos del tutor (Módulo 6).
   */
  async crear(req, res, next) {
    const client = await getClient();
    try {
      const datos = req.body || {};
      const errorValidacion = validarDatosVoluntario(datos);
      if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
      }

      const menorEdad = esMenorDeEdad(datos.fechaNacimiento);
      if (menorEdad && !datos.tutor?.nombre) {
        return res.status(400).json({
          error: 'El voluntario es menor de edad: se requieren los datos del tutor (Módulo 6).',
        });
      }

      await client.query('BEGIN');

      const voluntario = await VoluntarioModel.crear(
        { ...datos, asociacionId: req.usuario.asociacionId, creadoPor: req.usuario.id },
        client
      );

      if (datos.tiposVoluntario?.length) {
        await VoluntarioModel.asignarTipos(voluntario.id, datos.tiposVoluntario, client);
      }

      if (menorEdad) {
        await TutorModel.crear({ voluntarioId: voluntario.id, ...datos.tutor }, client);
      }

      await ExpedienteModel.crearParaVoluntario(voluntario.id, menorEdad, client);

      await client.query('COMMIT');

      const voluntarioCompleto = await VoluntarioModel.obtenerPorId(voluntario.id);
      return res.status(201).json({ voluntario: voluntarioCompleto });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      return next(err);
    } finally {
      client.release();
    }
  },

  /**
   * POST /api/voluntarios/importar  (multipart, campo "archivo": CSV o XLSX)
   * Columnas: nombre, fechaNacimiento (obligatorias) y apellidoPaterno,
   * apellidoMaterno, curp, correo, telefono (opcionales). Cada fila se valida
   * con las mismas reglas que el alta manual y se inserta en un SAVEPOINT:
   * una fila inválida o duplicada se reporta y NO tumba al resto.
   */
  async importar(req, res, next) {
    let client;
    try {
      if (!req.file) return res.status(400).json({ error: 'Adjunta un archivo CSV o XLSX.' });
      const workbook = new ExcelJS.Workbook();
      const esCsv = req.file.mimetype === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv');
      try {
        if (esCsv) await workbook.csv.readFile(req.file.path);
        else await workbook.xlsx.readFile(req.file.path);
      } catch {
        return res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un CSV o XLSX válido.' });
      }
      const hoja = workbook.worksheets[0];
      if (!hoja || hoja.rowCount < 2) return res.status(400).json({ error: 'El archivo debe contener encabezados y al menos una fila.' });
      if (hoja.rowCount - 1 > MAX_FILAS_IMPORTACION) {
        return res.status(400).json({ error: `El archivo excede el máximo de ${MAX_FILAS_IMPORTACION} filas por importación.` });
      }
      const encabezados = hoja.getRow(1).values.map((v) => String(valorDeCelda(v) || '').trim().toLowerCase());
      const indice = (nombre) => encabezados.indexOf(nombre);
      const nombreIndex = indice('nombre');
      const fechaIndex = indice('fechanacimiento');
      if (nombreIndex < 0 || fechaIndex < 0) return res.status(400).json({ error: 'Se requieren las columnas nombre y fechaNacimiento.' });

      const filas = [];
      hoja.eachRow((fila, numero) => {
        if (numero === 1) return;
        const v = fila.values;
        const leer = (col) => (indice(col) >= 0 ? valorDeCelda(v[indice(col)]) : undefined);
        filas.push({
          numero,
          datos: {
            nombre: valorDeCelda(v[nombreIndex]), fechaNacimiento: valorDeCelda(v[fechaIndex]),
            apellidoPaterno: leer('apellidopaterno'), apellidoMaterno: leer('apellidomaterno'),
            curp: leer('curp'), correo: leer('correo'), telefono: leer('telefono'),
          },
        });
      });

      client = await getClient();
      await client.query('BEGIN');
      const importados = [];
      const errores = [];
      for (const fila of filas) {
        const errorFila = validarDatosVoluntario(fila.datos);
        if (errorFila) { errores.push({ fila: fila.numero, error: errorFila }); continue; }
        if (esMenorDeEdad(fila.datos.fechaNacimiento)) {
          errores.push({ fila: fila.numero, error: 'Es menor de edad: requiere datos de tutor, regístralo con el alta manual.' });
          continue;
        }
        await client.query('SAVEPOINT fila');
        try {
          const duplicado = await client.query(
            `SELECT id FROM voluntarios WHERE asociacion_id = $1 AND (($2::text IS NOT NULL AND curp = $2) OR ($3::text IS NOT NULL AND lower(correo) = lower($3))) LIMIT 1`,
            [req.usuario.asociacionId, fila.datos.curp || null, fila.datos.correo || null]
          );
          if (duplicado.rows.length) {
            await client.query('ROLLBACK TO SAVEPOINT fila');
            errores.push({ fila: fila.numero, error: 'CURP o correo ya registrado.' });
            continue;
          }
          const voluntario = await VoluntarioModel.crear({ ...fila.datos, asociacionId: req.usuario.asociacionId, creadoPor: req.usuario.id }, client);
          await ExpedienteModel.crearParaVoluntario(voluntario.id, false, client);
          await client.query('RELEASE SAVEPOINT fila');
          importados.push(voluntario.id);
        } catch (errFila) {
          await client.query('ROLLBACK TO SAVEPOINT fila');
          errores.push({ fila: fila.numero, error: errFila.code === '23505' ? 'CURP o folio duplicado.' : 'No se pudo registrar esta fila.' });
        }
      }
      await client.query('COMMIT');
      return res.status(201).json({ importados: importados.length, errores });
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return next(err);
    } finally {
      if (client) client.release();
      if (req.file) fs.unlink(req.file.path, () => {});
    }
  },

  /**
   * PUT /api/voluntarios/:id
   */
  async actualizar(req, res, next) {
    try {
      const errorValidacion = validarDatosVoluntario(req.body, { parcial: true });
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });
      const esMenor = req.body.fechaNacimiento ? esMenorDeEdad(req.body.fechaNacimiento) : null;
      if (esMenor === true && !req.body.tutor?.nombre) {
        const actual = await VoluntarioModel.obtenerPorId(req.params.id);
        if (actual?.es_menor_edad === false) {
          return res.status(400).json({ error: 'El voluntario es menor de edad: se requieren los datos del tutor.' });
        }
      }
      const voluntario = await VoluntarioModel.actualizar(req.params.id, req.body);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      if (req.body.tiposVoluntario) {
        await VoluntarioModel.asignarTipos(voluntario.id, req.body.tiposVoluntario);
      }
      if (req.body.tutor) {
        const tutor = await TutorModel.actualizar(voluntario.id, req.body.tutor);
        if (!tutor && (esMenor === true || voluntario.es_menor_edad)) {
          await TutorModel.crear({ voluntarioId: voluntario.id, ...req.body.tutor });
        }
      }

      return res.json({ voluntario });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/tipos/disponibles
   */
  async listarTiposDisponibles(req, res, next) {
    try {
      const tipos = await VoluntarioModel.listarTiposDisponibles();
      return res.json({ tipos });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * DELETE /api/voluntarios/:id  (baja lógica)
   */
  async desactivar(req, res, next) {
    try {
      const resultado = await VoluntarioModel.desactivar(req.params.id);
      if (!resultado) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      return res.json({ voluntario: resultado });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/voluntarios/:id/foto
   * Fotografía de perfil del voluntario (multipart/form-data, campo "foto").
   * Se usa en la credencial digital y en la ficha del integrante (PDF).
   */
  async subirFoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "foto").' });
      }
      if (!req.file.mimetype.startsWith('image/')) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'La fotografía debe ser una imagen (PNG, JPG o WEBP).' });
      }

      const voluntarioAnterior = await VoluntarioModel.obtenerPorId(req.params.id);
      if (!voluntarioAnterior) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Voluntario no encontrado.' });
      }

      const referencia = await guardarArchivo({
        rutaLocal: req.file.path,
        ruta: `voluntarios/${req.params.id}/foto-${req.file.filename}`,
        contentType: req.file.mimetype,
      });
      if (almacenamientoRemoto) fs.unlink(req.file.path, () => {});
      const voluntario = await VoluntarioModel.actualizar(req.params.id, {
        fotografiaUrl: referencia,
      });

      await eliminarArchivo(voluntarioAnterior.fotografia_url);

      return res.status(201).json({ voluntario });
    } catch (err) {
      return next(err);
    }
  },
  /**
   * GET /api/voluntarios/:id/foto
   * Sirve la fotografía de perfil de forma autenticada (el proyecto no
   * expone /uploads como carpeta estática por seguridad — mismo criterio
   * que ya se usa para descargar documentos del expediente).
   */
  async obtenerFoto(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.obtenerPorId(req.params.id);
      if (!voluntario || !voluntario.fotografia_url) {
        return res.status(404).json({ error: 'Este voluntario no tiene fotografía registrada.' });
      }
      try {
        const contenido = await obtenerArchivo(voluntario.fotografia_url);
        const { fileTypeFromBuffer } = await import('file-type');
        const tipo = await fileTypeFromBuffer(contenido);
        res.set('Content-Type', tipo?.mime?.startsWith('image/') ? tipo.mime : 'application/octet-stream');
        res.set('X-Content-Type-Options', 'nosniff');
        res.send(contenido);
        return;
      } catch {
        return res.status(404).json({ error: 'La fotografía ya no existe en el almacenamiento.' });
      }
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = VoluntarioController;
