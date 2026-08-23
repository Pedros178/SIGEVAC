const { query, getClient } = require('../config/database');

const VoluntarioModel = {
  /**
   * Genera el siguiente folio de voluntario para una asociación, p.ej. SC-2026-0001
   */
  async _generarNumeroVoluntario(client, asociacionId) {
    const anio = new Date().getFullYear();
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM voluntarios
       WHERE asociacion_id = $1 AND EXTRACT(YEAR FROM creado_en) = $2`,
      [asociacionId, anio]
    );
    const consecutivo = String(rows[0].total + 1).padStart(4, '0');
    return `SC-${anio}-${consecutivo}`;
  },

  async crear(datos, client = null) {
    const ejecutor = client || (await getClient());
    const debeLiberar = !client;
    try {
      if (!client) await ejecutor.query('BEGIN');

      const numeroVoluntario = await this._generarNumeroVoluntario(ejecutor, datos.asociacionId);

      const fechaNac = new Date(datos.fechaNacimiento);
      const hoy = new Date();
      const esMenorEdad = (hoy.getFullYear() - fechaNac.getFullYear()
        - (hoy < new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate()) ? 1 : 0)) < 18;

      const { rows } = await ejecutor.query(
        `INSERT INTO voluntarios (
           asociacion_id, numero_voluntario, fotografia_url, nombre, apellido_paterno,
           apellido_materno, curp, sexo, fecha_nacimiento, estado_civil, nacionalidad,
           correo, telefono, direccion, codigo_postal, municipio_id, estado_id,
           tipo_sangre, alergias, contacto_emergencia_nombre, contacto_emergencia_telefono,
           contacto_emergencia_parentesco, creado_por, es_menor_edad
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [
          datos.asociacionId, numeroVoluntario, datos.fotografiaUrl || null, datos.nombre,
          datos.apellidoPaterno || null, datos.apellidoMaterno || null, datos.curp || null,
          datos.sexo || null, datos.fechaNacimiento, datos.estadoCivil || null,
          datos.nacionalidad || 'Mexicana', datos.correo || null, datos.telefono || null,
          datos.direccion || null, datos.codigoPostal || null, datos.municipioId || null,
          datos.estadoId || null, datos.tipoSangre || null, datos.alergias || null,
          datos.contactoEmergenciaNombre || null, datos.contactoEmergenciaTelefono || null,
          datos.contactoEmergenciaParentesco || null, datos.creadoPor || null, esMenorEdad,
        ]
      );

      if (!client) await ejecutor.query('COMMIT');
      return rows[0];
    } catch (err) {
      if (!client) await ejecutor.query('ROLLBACK');
      throw err;
    } finally {
      if (debeLiberar) ejecutor.release();
    }
  },

  async obtenerPorId(id) {
    const { rows } = await query(
      `SELECT v.*, m.nombre AS municipio_nombre, e.nombre AS estado_nombre
       FROM voluntarios v
       LEFT JOIN municipios m ON m.id = v.municipio_id
       LEFT JOIN estados_mx e ON e.id = v.estado_id
       WHERE v.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async listar({ asociacionId, activo, busqueda, tipo, limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT v.id, v.numero_voluntario, v.nombre, v.apellido_paterno, v.apellido_materno,
              v.curp, v.correo, v.telefono, v.es_menor_edad, v.activo, v.creado_en, v.fotografia_url,
              ex.estado AS expediente_estado, ex.porcentaje_avance
       FROM voluntarios v
       LEFT JOIN expedientes ex ON ex.voluntario_id = v.id
       WHERE v.asociacion_id = $1
         AND ($2::boolean IS NULL OR v.activo = $2)
         AND ($3::text IS NULL OR v.nombre ILIKE '%' || $3 || '%' OR v.curp ILIKE '%' || $3 || '%')
         AND ($4::int IS NULL OR EXISTS (
               SELECT 1 FROM voluntarios_tipos vt WHERE vt.voluntario_id = v.id AND vt.tipo_voluntario_id = $4
             ))
       ORDER BY v.creado_en DESC
       LIMIT $5 OFFSET $6`,
      [asociacionId, activo ?? null, busqueda || null, tipo || null, limit, offset]
    );
    return rows;
  },

  async actualizar(id, datos) {
    const campos = {
      nombre: datos.nombre, apellido_paterno: datos.apellidoPaterno, apellido_materno: datos.apellidoMaterno,
      curp: datos.curp, correo: datos.correo, telefono: datos.telefono, direccion: datos.direccion,
      codigo_postal: datos.codigoPostal, tipo_sangre: datos.tipoSangre, alergias: datos.alergias,
      contacto_emergencia_nombre: datos.contactoEmergenciaNombre,
      contacto_emergencia_telefono: datos.contactoEmergenciaTelefono,
      contacto_emergencia_parentesco: datos.contactoEmergenciaParentesco,
      fotografia_url: datos.fotografiaUrl,
    };
    const sets = [];
    const valores = [];
    let i = 1;
    for (const [col, val] of Object.entries(campos)) {
      if (val !== undefined) {
        sets.push(`${col} = $${i}`);
        valores.push(val);
        i += 1;
      }
    }
    if (sets.length === 0) return this.obtenerPorId(id);
    valores.push(id);
    const { rows } = await query(
      `UPDATE voluntarios SET ${sets.join(', ')}, actualizado_en = now() WHERE id = $${i} RETURNING *`,
      valores
    );
    return rows[0];
  },

  async desactivar(id) {
    const { rows } = await query(
      `UPDATE voluntarios SET activo = false, actualizado_en = now() WHERE id = $1 RETURNING id, activo`,
      [id]
    );
    return rows[0];
  },

  /**
   * Asigna tipos de voluntario a partir de sus CLAVES (p.ej. 'servicio_social'),
   * que es lo que envía el frontend — no sus ids numéricos.
   */
  async asignarTipos(voluntarioId, tiposClaves, client = null) {
    const ejecutor = client || { query };
    if (!tiposClaves?.length) return;
    await ejecutor.query(`DELETE FROM voluntarios_tipos WHERE voluntario_id = $1`, [voluntarioId]);
    await ejecutor.query(
      `INSERT INTO voluntarios_tipos (voluntario_id, tipo_voluntario_id)
       SELECT $1, id FROM tipos_voluntario WHERE clave = ANY($2::text[])
       ON CONFLICT DO NOTHING`,
      [voluntarioId, tiposClaves]
    );
  },

  async obtenerTipos(voluntarioId) {
    const { rows } = await query(
      `SELECT tv.id, tv.clave, tv.etiqueta
       FROM tipos_voluntario tv
       JOIN voluntarios_tipos vt ON vt.tipo_voluntario_id = tv.id
       WHERE vt.voluntario_id = $1`,
      [voluntarioId]
    );
    return rows;
  },

  /**
   * Catálogo completo de tipos de voluntario (Módulo 5), para poblar
   * el formulario de registro/edición en el frontend.
   */
  async listarTiposDisponibles() {
    const { rows } = await query(`SELECT id, clave, etiqueta FROM tipos_voluntario ORDER BY etiqueta`);
    return rows;
  },
};

module.exports = VoluntarioModel;
