const { query, getClient } = require('../config/database');
const { esMenorDeEdad } = require('../utils/edad');

/**
 * Normaliza el texto del buscador: recorta, descarta lo vacío y escapa los
 * comodines de LIKE (%, _, \) para que se busquen literalmente. Cada palabra
 * debe aparecer en nombre completo, CURP, correo o folio (AND entre palabras).
 */
function textoBusqueda(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.replaceAll('\u0000', '').trim().slice(0, 100);
  return limpio ? limpio.replace(/[\\%_]/g, '\\$&') : null;
}

const PREFIJO_FOLIO = (process.env.FOLIO_PREFIJO || 'SC').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'SC';

const VoluntarioModel = {
  /**
   * Genera el siguiente folio global del año, p.ej. SC-2026-0001
   */
  async _generarNumeroVoluntario(client) {
    const anio = new Date().getFullYear();
    await client.query('SELECT pg_advisory_xact_lock($1)', [87342026]);
    // MAX+1 (no COUNT+1): si se borra un registro, COUNT repetiría un folio
    // existente y el UNIQUE provocaba un 500. El lock de arriba serializa.
    const { rows } = await client.query(
      `SELECT COALESCE(MAX((substring(numero_voluntario from '[0-9]+$'))::int), 0) AS maximo
       FROM voluntarios WHERE numero_voluntario ~ $1`,
      [`^${PREFIJO_FOLIO}-${anio}-[0-9]+$`]
    );
    const consecutivo = String(Number(rows[0].maximo) + 1).padStart(4, '0');
    return `${PREFIJO_FOLIO}-${anio}-${consecutivo}`;
  },

  async crear(datos, client = null) {
    const ejecutor = client || (await getClient());
    const debeLiberar = !client;
    try {
      if (!client) await ejecutor.query('BEGIN');

      const numeroVoluntario = await this._generarNumeroVoluntario(ejecutor);

      const esMenorEdad = esMenorDeEdad(datos.fechaNacimiento);

      let estadoId = datos.estadoId || null;
      let municipioId = datos.municipioId || null;
      if (!estadoId && datos.estado?.trim()) {
        const estadoExistente = await ejecutor.query(
          'SELECT id FROM estados_mx WHERE lower(nombre) = lower($1) LIMIT 1', [datos.estado.trim()]
        );
        if (estadoExistente.rows[0]) {
          estadoId = estadoExistente.rows[0].id;
        } else {
          const nuevoEstado = await ejecutor.query(
            'INSERT INTO estados_mx (nombre) VALUES ($1) RETURNING id', [datos.estado.trim()]
          );
          estadoId = nuevoEstado.rows[0].id;
        }
      }
      if (!municipioId && datos.municipio?.trim() && estadoId) {
        const municipioExistente = await ejecutor.query(
          'SELECT id FROM municipios WHERE estado_id = $1 AND lower(nombre) = lower($2) LIMIT 1',
          [estadoId, datos.municipio.trim()]
        );
        if (municipioExistente.rows[0]) {
          municipioId = municipioExistente.rows[0].id;
        } else {
          const nuevoMunicipio = await ejecutor.query(
            'INSERT INTO municipios (estado_id, nombre) VALUES ($1, $2) RETURNING id',
            [estadoId, datos.municipio.trim()]
          );
          municipioId = nuevoMunicipio.rows[0].id;
        }
      }

      const { rows } = await ejecutor.query(
        `INSERT INTO voluntarios (
           asociacion_id, numero_voluntario, numero_control, fotografia_url, fecha_ingreso, fecha_baja, nombre, apellido_paterno,
           apellido_materno, curp, sexo, fecha_nacimiento, estado_civil, nacionalidad,
           correo, telefono, telefono_fijo, telefono_celular, direccion, colonia, codigo_postal, municipio_id, estado_id,
           tipo_sangre, alergias, discapacidad, enfermedad_cronica, contacto_emergencia_nombre, contacto_emergencia_telefono,
           contacto_emergencia_parentesco, contacto_emergencia_domicilio, contacto_emergencia_colonia,
           contacto_emergencia_municipio, contacto_emergencia_estado, contacto_emergencia_telefono_fijo,
           contacto_emergencia_telefono_celular, contacto_emergencia_correo, creado_por, es_menor_edad
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)
         RETURNING *`,
        [
          datos.asociacionId, numeroVoluntario, datos.numeroControl || null, datos.fotografiaUrl || null, datos.fechaIngreso || new Date().toISOString().slice(0, 10),
          datos.fechaBaja || null, datos.nombre, datos.apellidoPaterno || null, datos.apellidoMaterno || null,
          datos.curp || null, datos.sexo || null, datos.fechaNacimiento, datos.estadoCivil || null,
          datos.nacionalidad || 'Mexicana', datos.correo || null, datos.telefono || null, datos.telefonoFijo || null,
          datos.telefonoCelular || null, datos.direccion || null, datos.colonia || null, datos.codigoPostal || null,
          municipioId, estadoId, datos.tipoSangre || null, datos.alergias || null,
          datos.discapacidad || null, datos.enfermedadCronica || null, datos.contactoEmergenciaNombre || null,
          datos.contactoEmergenciaTelefono || null, datos.contactoEmergenciaParentesco || null,
          datos.contactoEmergenciaDomicilio || null, datos.contactoEmergenciaColonia || null,
          datos.contactoEmergenciaMunicipio || null, datos.contactoEmergenciaEstado || null,
          datos.contactoEmergenciaTelefonoFijo || null, datos.contactoEmergenciaTelefonoCelular || null,
          datos.contactoEmergenciaCorreo || null, datos.creadoPor || null, esMenorEdad,
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
              v.curp, v.correo, v.telefono, v.telefono_fijo, v.telefono_celular, v.colonia, v.numero_control, v.es_menor_edad, v.activo, v.fecha_ingreso, v.fecha_baja, v.creado_en, v.fotografia_url,
              ex.estado AS expediente_estado, ex.porcentaje_avance
       FROM voluntarios v
       LEFT JOIN expedientes ex ON ex.voluntario_id = v.id
       WHERE v.asociacion_id = $1
         AND ($2::boolean IS NULL OR v.activo = $2)
         AND ($3::text IS NULL OR NOT EXISTS (
               SELECT 1 FROM unnest(string_to_array($3, ' ')) AS palabra
               WHERE palabra <> '' AND NOT (
                 concat_ws(' ', v.nombre, v.apellido_paterno, v.apellido_materno, v.curp, v.correo, v.numero_voluntario)
                   ILIKE '%' || palabra || '%'
               )
             ))
         AND ($4::int IS NULL OR EXISTS (
               SELECT 1 FROM voluntarios_tipos vt WHERE vt.voluntario_id = v.id AND vt.tipo_voluntario_id = $4
             ))
       ORDER BY v.creado_en DESC
       LIMIT $5 OFFSET $6`,
      [asociacionId, activo ?? null, textoBusqueda(busqueda), tipo || null, limit, offset]
    );
    return rows;
  },

  /**
   * Cifras agregadas para la página pública (sección "Cifras" del Home).
   * Nunca expone datos individuales de voluntarios, solo conteos.
   */
  async estadisticasPublicas(asociacionId) {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE v.activo)::int AS voluntarios_activos,
         COUNT(DISTINCT e.nombre) FILTER (WHERE v.activo)::int AS estados_con_presencia
       FROM voluntarios v
       LEFT JOIN estados_mx e ON e.id = v.estado_id
       WHERE v.asociacion_id = $1`,
      [asociacionId]
    );
    return rows[0] || { voluntarios_activos: 0, estados_con_presencia: 0 };
  },

  async actualizar(id, datos) {
    let estadoId;
    let municipioId;
    if (datos.estado !== undefined) {
      if (datos.estado.trim()) {
        const estadoExistente = await query('SELECT id FROM estados_mx WHERE lower(nombre) = lower($1) LIMIT 1', [datos.estado.trim()]);
        if (estadoExistente.rows[0]) estadoId = estadoExistente.rows[0].id;
        else estadoId = (await query('INSERT INTO estados_mx (nombre) VALUES ($1) RETURNING id', [datos.estado.trim()])).rows[0].id;
      } else estadoId = null;
    }
    if (datos.municipio !== undefined) {
      if (estadoId && datos.municipio.trim()) {
        const municipioExistente = await query(
          'SELECT id FROM municipios WHERE estado_id = $1 AND lower(nombre) = lower($2) LIMIT 1',
          [estadoId, datos.municipio.trim()]
        );
        if (municipioExistente.rows[0]) municipioId = municipioExistente.rows[0].id;
        else municipioId = (await query(
          'INSERT INTO municipios (estado_id, nombre) VALUES ($1, $2) RETURNING id',
          [estadoId, datos.municipio.trim()]
        )).rows[0].id;
      } else {
        // Sin estado (se limpió, o nunca se mandó uno válido) o sin texto de
        // municipio: se limpia explícitamente en vez de dejarlo "undefined",
        // que el UPDATE dinámico de abajo simplemente ignoraría — y dejaría
        // un municipio_id viejo apuntando a un estado que ya no aplica.
        municipioId = null;
      }
    }
    const campos = {
      nombre: datos.nombre, numero_control: datos.numeroControl, apellido_paterno: datos.apellidoPaterno, apellido_materno: datos.apellidoMaterno,
      fecha_ingreso: datos.fechaIngreso, fecha_baja: datos.fechaBaja, fecha_nacimiento: datos.fechaNacimiento,
      sexo: datos.sexo, curp: datos.curp, correo: datos.correo, telefono: datos.telefono, telefono_fijo: datos.telefonoFijo,
      estado_id: estadoId, municipio_id: municipioId,
      telefono_celular: datos.telefonoCelular, direccion: datos.direccion, colonia: datos.colonia,
      codigo_postal: datos.codigoPostal, tipo_sangre: datos.tipoSangre, alergias: datos.alergias,
      discapacidad: datos.discapacidad, enfermedad_cronica: datos.enfermedadCronica,
      contacto_emergencia_nombre: datos.contactoEmergenciaNombre,
      contacto_emergencia_telefono: datos.contactoEmergenciaTelefono,
      contacto_emergencia_parentesco: datos.contactoEmergenciaParentesco,
      contacto_emergencia_domicilio: datos.contactoEmergenciaDomicilio,
      contacto_emergencia_colonia: datos.contactoEmergenciaColonia,
      contacto_emergencia_municipio: datos.contactoEmergenciaMunicipio,
      contacto_emergencia_estado: datos.contactoEmergenciaEstado,
      contacto_emergencia_telefono_fijo: datos.contactoEmergenciaTelefonoFijo,
      contacto_emergencia_telefono_celular: datos.contactoEmergenciaTelefonoCelular,
      contacto_emergencia_correo: datos.contactoEmergenciaCorreo,
      fotografia_url: datos.fotografiaUrl,
    };
    if (datos.fechaNacimiento) {
      campos.es_menor_edad = esMenorDeEdad(datos.fechaNacimiento);
    }
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
      `UPDATE voluntarios SET activo = false, fecha_baja = COALESCE(fecha_baja, CURRENT_DATE), actualizado_en = now() WHERE id = $1 RETURNING id, activo, fecha_baja`,
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
