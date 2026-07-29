const { getClient } = require('../config/database');
const VoluntarioModel = require('../models/voluntarioModel');
const TutorModel = require('../models/tutorModel');
const { ExpedienteModel } = require('../models/expedienteModel');

function esMenorDeEdad(fechaNacimiento) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - nacimiento.getFullYear()
    - (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate()) ? 1 : 0);
  return edad < 18;
}

const VoluntarioController = {
  /**
   * GET /api/voluntarios
   */
  async listar(req, res, next) {
    try {
      const { activo, busqueda, tipo, limit = 50, offset = 0 } = req.query;
      const voluntarios = await VoluntarioModel.listar({
        asociacionId: req.usuario.asociacionId,
        activo: activo === undefined ? null : activo === 'true',
        busqueda,
        tipo: tipo ? Number(tipo) : null,
        limit: Number(limit),
        offset: Number(offset),
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
      const datos = req.body;
      if (!datos.nombre || !datos.fechaNacimiento) {
        return res.status(400).json({ error: 'nombre y fechaNacimiento son obligatorios.' });
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
      await client.query('ROLLBACK');
      return next(err);
    } finally {
      client.release();
    }
  },

  /**
   * PUT /api/voluntarios/:id
   */
  async actualizar(req, res, next) {
    try {
      const voluntario = await VoluntarioModel.actualizar(req.params.id, req.body);
      if (!voluntario) return res.status(404).json({ error: 'Voluntario no encontrado.' });

      if (req.body.tiposVoluntario) {
        await VoluntarioModel.asignarTipos(voluntario.id, req.body.tiposVoluntario);
      }
      if (req.body.tutor) {
        await TutorModel.actualizar(voluntario.id, req.body.tutor);
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
};

module.exports = VoluntarioController;
