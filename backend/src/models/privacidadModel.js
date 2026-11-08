const { query, getClient } = require('../config/database');
const VoluntarioModel = require('./voluntarioModel');

const NOMBRE_ANONIMO = 'Persona anonimizada';

/** Subconsulta SQL: el día hábil número N (lunes a viernes) contado DESPUÉS de la fecha base. */
const SQL_DIAS_HABILES = (base, n) => `(SELECT d::date FROM generate_series((${base})::date + 1, (${base})::date + ${n * 2 + 10}, interval '1 day') d
   WHERE extract(isodow FROM d) < 6 OFFSET ${n - 1} LIMIT 1)`;

const PrivacidadModel = {
  // ---------- Consentimientos / aviso de privacidad ----------
  async registrarConsentimiento({ asociacionId, voluntarioId, versionAviso, finalidadesSecundarias, medio, usuarioId, tipo, otorgadoPor }, client) {
    const ejecutor = client || { query };
    const { rows } = await ejecutor.query(
      `INSERT INTO consentimientos_privacidad (asociacion_id, voluntario_id, version_aviso, finalidades_secundarias, medio, registrado_por, tipo, otorgado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [asociacionId, voluntarioId, versionAviso, Boolean(finalidadesSecundarias), medio || 'presencial', usuarioId || null, tipo || 'aviso', otorgadoPor || 'titular']
    );
    return rows[0];
  },

  /** ¿Existe un consentimiento vigente (no revocado) de este tipo? (art. 8: datos sensibles). */
  async tieneConsentimientoVigente(voluntarioId, tipo, client) {
    const ejecutor = client || { query };
    const { rows } = await ejecutor.query(
      `SELECT 1 FROM consentimientos_privacidad WHERE voluntario_id = $1 AND tipo = $2 AND revocado_en IS NULL LIMIT 1`,
      [voluntarioId, tipo]
    );
    return Boolean(rows[0]);
  },

  async listarConsentimientos(voluntarioId) {
    const { rows } = await query(
      `SELECT id, tipo, otorgado_por, version_aviso, finalidades_secundarias, medio, revocado_en, creado_en
       FROM consentimientos_privacidad WHERE voluntario_id = $1 ORDER BY creado_en DESC`,
      [voluntarioId]
    );
    return rows;
  },

  /**
   * Revoca (no borra: la constancia se conserva) un consentimiento del voluntario indicado. Art. 7: la
   * revocación no tiene efectos retroactivos, pero SÍ debe cesar el tratamiento: si el consentimiento revocado
   * era el de datos sensibles y no queda otro vigente, se eliminan los datos de salud guardados.
   */
  async revocarConsentimiento(id, voluntarioId) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE consentimientos_privacidad SET revocado_en = now()
         WHERE id = $1 AND voluntario_id = $2 AND revocado_en IS NULL
         RETURNING id, tipo, otorgado_por, version_aviso, finalidades_secundarias, medio, revocado_en, creado_en`,
        [id, voluntarioId]
      );
      if (!rows[0]) { await client.query('ROLLBACK'); return null; }
      let datosSensiblesEliminados = false;
      if (rows[0].tipo === 'datos_sensibles' && !(await this.tieneConsentimientoVigente(voluntarioId, 'datos_sensibles', client))) {
        await client.query(
          `UPDATE voluntarios SET tipo_sangre = NULL, alergias = NULL, discapacidad = NULL, enfermedad_cronica = NULL, actualizado_en = now() WHERE id = $1`,
          [voluntarioId]
        );
        datosSensiblesEliminados = true;
      }
      await client.query('COMMIT');
      return { ...rows[0], datos_sensibles_eliminados: datosSensiblesEliminados };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ---------- Acceso / portabilidad ----------
  /** Reúne TODOS los datos personales que el sistema guarda de un voluntario (derecho de acceso). */
  async exportarDatos(voluntarioId) {
    const voluntario = await VoluntarioModel.obtenerPorId(voluntarioId);
    if (!voluntario) return null;
    const { fotografia_url: fotografiaUrl, creado_por: _creadoPor, ...datos } = voluntario;

    const [tipos, tutor, documentos, participaciones, horas, insignias, prestamos, pagos, consentimientos, arco] = await Promise.all([
      VoluntarioModel.obtenerTipos(voluntarioId),
      query(`SELECT nombre, curp, ine, telefono, correo, parentesco, creado_en FROM tutores WHERE voluntario_id = $1`, [voluntarioId]),
      query(
        `SELECT td.clave AS tipo, td.etiqueta, d.estado, d.vigencia_hasta, d.observaciones,
                COALESCE(json_agg(json_build_object('nombre_original', a.nombre_original, 'mime_type', a.mime_type,
                  'tamano_bytes', a.tamano_bytes, 'version', a.version, 'subido_en', a.creado_en) ORDER BY a.version)
                  FILTER (WHERE a.id IS NOT NULL), '[]') AS archivos
         FROM expedientes e
         JOIN documentos d ON d.expediente_id = e.id
         JOIN tipos_documento td ON td.id = d.tipo_documento_id
         LEFT JOIN archivos a ON a.documento_id = d.id
         WHERE e.voluntario_id = $1 GROUP BY td.clave, td.etiqueta, d.estado, d.vigencia_hasta, d.observaciones ORDER BY td.etiqueta`,
        [voluntarioId]
      ),
      query(
        `SELECT ac.nombre AS actividad, ac.fecha, p.inscrito_en, s.hora_entrada, s.hora_salida, s.horas_realizadas
         FROM participaciones p JOIN actividades ac ON ac.id = p.actividad_id
         LEFT JOIN asistencias s ON s.participacion_id = p.id
         WHERE p.voluntario_id = $1 ORDER BY ac.fecha DESC`,
        [voluntarioId]
      ),
      query(`SELECT tipo, periodo, horas_acumuladas::float AS horas FROM horas_servicio WHERE voluntario_id = $1 ORDER BY periodo DESC`, [voluntarioId]),
      query(
        `SELECT i.nombre, i.descripcion, vi.obtenida_en FROM voluntario_insignias vi JOIN insignias i ON i.id = vi.insignia_id
         WHERE vi.voluntario_id = $1 ORDER BY vi.obtenida_en DESC`,
        [voluntarioId]
      ),
      query(`SELECT responsable, contacto, motivo, fecha_prestamo, fecha_devolucion_real, estado FROM inventario_prestamos WHERE voluntario_id = $1`, [voluntarioId]),
      query(`SELECT monto::float AS monto, metodo, referencia, pagado_en FROM pagos_cuotas WHERE voluntario_id = $1 ORDER BY pagado_en DESC`, [voluntarioId]),
      this.listarConsentimientos(voluntarioId),
      query(`SELECT tipo, estado, detalle, resolucion, creado_en, atendida_en FROM solicitudes_arco WHERE voluntario_id = $1 ORDER BY creado_en DESC`, [voluntarioId]),
    ]);

    return {
      generado_en: new Date().toISOString(),
      voluntario: { ...datos, tiene_fotografia: Boolean(fotografiaUrl) },
      tipos_voluntario: tipos.map((t) => t.etiqueta),
      tutor: tutor.rows[0] || null,
      documentos: documentos.rows,
      participaciones: participaciones.rows,
      horas_servicio: horas.rows,
      insignias: insignias.rows,
      prestamos_inventario: prestamos.rows,
      pagos_cuotas: pagos.rows,
      consentimientos,
      solicitudes_arco: arco.rows,
    };
  },

  // ---------- Cancelación (anonimización) ----------
  /**
   * Borra o anonimiza los datos personales del voluntario conservando solo lo necesario para
   * estadísticas (horas, participaciones) sin poder identificar a la persona. Todo en UNA
   * transacción. Devuelve las URLs de archivos a eliminar del almacenamiento (el llamador las
   * borra DESPUÉS de confirmar la transacción: si falla, no queda la BD sin sus archivos).
   */
  async anonimizar(voluntarioId, asociacionId) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, correo, fotografia_url, anonimizado_en FROM voluntarios WHERE id = $1 AND asociacion_id = $2 FOR UPDATE`,
        [voluntarioId, asociacionId]
      );
      if (!rows[0]) { await client.query('ROLLBACK'); return { estado: 'no_encontrado' }; }
      if (rows[0].anonimizado_en) { await client.query('ROLLBACK'); return { estado: 'ya_anonimizado' }; }

      const archivos = [];
      if (rows[0].fotografia_url) archivos.push(rows[0].fotografia_url);
      const { rows: docs } = await client.query(
        `SELECT a.url FROM archivos a JOIN documentos d ON d.id = a.documento_id JOIN expedientes e ON e.id = d.expediente_id WHERE e.voluntario_id = $1`,
        [voluntarioId]
      );
      archivos.push(...docs.map((d) => d.url));
      const { rows: cred } = await client.query(`SELECT url_pdf FROM credenciales WHERE voluntario_id = $1 AND url_pdf IS NOT NULL`, [voluntarioId]);
      archivos.push(...cred.map((c) => c.url_pdf));

      // La solicitud pública que dio origen al voluntario (mismo correo) también guarda sus datos.
      if (rows[0].correo) {
        await client.query(`DELETE FROM solicitudes_voluntariado WHERE asociacion_id = $1 AND lower(correo) = lower($2)`, [asociacionId, rows[0].correo]);
      }
      // El expediente arrastra por cascada documentos, archivos y firmas (imagen de firma, IP, user-agent).
      await client.query(`DELETE FROM expedientes WHERE voluntario_id = $1`, [voluntarioId]);
      await client.query(`DELETE FROM tutores WHERE voluntario_id = $1`, [voluntarioId]);
      await client.query(`DELETE FROM qr_codigos WHERE voluntario_id = $1`, [voluntarioId]); // el certificado público deja de resolver
      await client.query(`DELETE FROM credenciales WHERE voluntario_id = $1`, [voluntarioId]);
      await client.query(`DELETE FROM notificaciones WHERE voluntario_id = $1`, [voluntarioId]);
      await client.query(`UPDATE inventario_prestamos SET responsable = $2, contacto = NULL WHERE voluntario_id = $1`, [voluntarioId, NOMBRE_ANONIMO]);
      await client.query(`UPDATE pagos_cuotas SET referencia = NULL WHERE voluntario_id = $1`, [voluntarioId]);

      await client.query(
        `UPDATE voluntarios SET
           nombre = $2, apellido_paterno = NULL, apellido_materno = NULL, curp = NULL, sexo = NULL,
           numero_control = NULL, fotografia_url = NULL, estado_civil = NULL,
           correo = NULL, telefono = NULL, telefono_fijo = NULL, telefono_celular = NULL,
           direccion = NULL, colonia = NULL, codigo_postal = NULL, municipio_id = NULL, estado_id = NULL,
           tipo_sangre = NULL, alergias = NULL, discapacidad = NULL, enfermedad_cronica = NULL,
           contacto_emergencia_nombre = NULL, contacto_emergencia_telefono = NULL, contacto_emergencia_parentesco = NULL,
           contacto_emergencia_domicilio = NULL, contacto_emergencia_colonia = NULL, contacto_emergencia_municipio = NULL,
           contacto_emergencia_estado = NULL, contacto_emergencia_telefono_fijo = NULL,
           contacto_emergencia_telefono_celular = NULL, contacto_emergencia_correo = NULL,
           -- la fecha de nacimiento es obligatoria en el esquema: se deja solo el año (1 de enero), que basta para saber si era menor
           fecha_nacimiento = date_trunc('year', fecha_nacimiento)::date,
           activo = false, fecha_baja = COALESCE(fecha_baja, CURRENT_DATE),
           anonimizado_en = now(), actualizado_en = now()
         WHERE id = $1`,
        [voluntarioId, NOMBRE_ANONIMO]
      );
      await client.query('COMMIT');
      return { estado: 'ok', archivos };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ---------- Conservación de datos ----------
  /**
   * Voluntarios dados de baja hace más de N años y todavía con datos personales. NO se anonimiza
   * nada solo: es una lista para que la asociación decida (puede tener razones legales o de
   * constancia para conservarlos); luego se usa POST /voluntarios/:id/anonimizar.
   */
  async candidatosARetencion(asociacionId, anios) {
    const { rows } = await query(
      `SELECT id, numero_voluntario, trim(concat_ws(' ', nombre, apellido_paterno, apellido_materno)) AS nombre, fecha_baja
       FROM voluntarios
       WHERE asociacion_id = $1 AND anonimizado_en IS NULL AND activo = false AND fecha_baja IS NOT NULL
         AND fecha_baja < CURRENT_DATE - ($2 || ' years')::interval
       ORDER BY fecha_baja LIMIT 500`,
      [asociacionId, String(anios)]
    );
    return rows;
  },

  // ---------- Solicitudes ARCO ----------
  // Los días se cuentan HÁBILES (lunes a viernes; art. 2, fr. VIII). No se descuentan feriados oficiales: el plazo
  // real puede ser un poco más largo, nunca más corto, así que la alerta es conservadora.
  async crearSolicitudArco({ asociacionId, voluntarioId, tipo, detalle, usuarioId }) {
    const { rows } = await query(
      `INSERT INTO solicitudes_arco (asociacion_id, voluntario_id, tipo, detalle, registrada_por, fecha_limite)
       VALUES ($1,$2,$3,$4,$5, ${SQL_DIAS_HABILES('CURRENT_DATE', 20)}) RETURNING *`,
      [asociacionId, voluntarioId || null, tipo, detalle || null, usuarioId || null]
    );
    return rows[0];
  },

  async listarSolicitudesArco(asociacionId, estado) {
    const { rows } = await query(
      `SELECT s.*,
              ((s.estado = 'recibida' AND s.fecha_limite < CURRENT_DATE)
               OR (s.estado = 'en_proceso' AND s.fecha_limite_ejecucion IS NOT NULL AND s.fecha_limite_ejecucion < CURRENT_DATE)) AS vencida,
              CASE WHEN v.anonimizado_en IS NULL THEN trim(concat_ws(' ', v.nombre, v.apellido_paterno, v.apellido_materno)) ELSE v.nombre END AS voluntario_nombre
       FROM solicitudes_arco s LEFT JOIN voluntarios v ON v.id = s.voluntario_id
       WHERE s.asociacion_id = $1 AND ($2::text IS NULL OR s.estado = $2)
       ORDER BY s.creado_en DESC LIMIT 500`,
      [asociacionId, estado || null]
    );
    return rows;
  },

  /**
   * 'en_proceso' = ya se comunicó la determinación y se está haciendo efectiva: arranca el plazo de 15 días hábiles
   * (art. 31). 'atendida'/'rechazada' cierran. Si se cancela, se debe avisar a la persona titular (art. 24):
   * `notificadoTitular` deja constancia.
   */
  async resolverSolicitudArco(id, asociacionId, { estado, resolucion, usuarioId, notificadoTitular }) {
    const cierra = estado === 'atendida' || estado === 'rechazada';
    const { rows } = await query(
      `UPDATE solicitudes_arco SET estado = $3::varchar, resolucion = COALESCE($4::text, resolucion),
              atendida_por = CASE WHEN $5::boolean THEN $6::uuid ELSE atendida_por END,
              atendida_en = CASE WHEN $5::boolean THEN now() ELSE atendida_en END,
              fecha_limite_ejecucion = CASE WHEN $3::varchar = 'en_proceso' AND fecha_limite_ejecucion IS NULL
                                            THEN ${SQL_DIAS_HABILES('CURRENT_DATE', 15)} ELSE fecha_limite_ejecucion END,
              titular_notificado_en = CASE WHEN $7::boolean AND titular_notificado_en IS NULL THEN now() ELSE titular_notificado_en END
       WHERE id = $1 AND asociacion_id = $2 RETURNING *`,
      [id, asociacionId, estado, resolucion || null, cierra, usuarioId, Boolean(notificadoTitular)]
    );
    return rows[0] || null;
  },

  /** Art. 31: los plazos se pueden ampliar UNA sola vez, por un periodo igual (20 días hábiles más). */
  async ampliarSolicitudArco(id, asociacionId) {
    const { rows } = await query(
      `UPDATE solicitudes_arco SET ampliada = true, fecha_limite = ${SQL_DIAS_HABILES('fecha_limite', 20)}
       WHERE id = $1 AND asociacion_id = $2 AND ampliada = false AND estado IN ('recibida', 'en_proceso') RETURNING *`,
      [id, asociacionId]
    );
    return rows[0] || null;
  },

  /** Versión del aviso vigente: la configurada por la asociación, o AVISO_PRIVACIDAD_VERSION, o '2026-1'. */
  async versionAvisoVigente(asociacionId) {
    const { rows } = await query(`SELECT valor FROM configuracion WHERE asociacion_id = $1 AND clave = 'privacidad.version_aviso'`, [asociacionId]);
    const configurada = rows[0] && typeof rows[0].valor === 'string' ? rows[0].valor.trim() : '';
    return configurada || process.env.AVISO_PRIVACIDAD_VERSION || '2026-1';
  },

  // ---------- Aviso de privacidad configurable (art. 15) ----------
  async obtenerAviso(asociacionId) {
    const { rows } = await query(
      `SELECT a.nombre AS responsable, c.clave, c.valor FROM asociaciones a
       LEFT JOIN configuracion c ON c.asociacion_id = a.id AND c.clave LIKE 'privacidad.%'
       WHERE a.id = $1`,
      [asociacionId]
    );
    if (!rows.length) return null;
    const aviso = { responsable: rows[0].responsable };
    for (const f of rows) if (f.clave) aviso[f.clave.replace('privacidad.', '')] = f.valor;
    return aviso;
  },

  async guardarAviso(asociacionId, campos) {
    for (const [clave, valor] of Object.entries(campos)) {
      await query(
        `INSERT INTO configuracion (asociacion_id, clave, valor) VALUES ($1, $2, $3)
         ON CONFLICT (asociacion_id, clave) DO UPDATE SET valor = $3`,
        [asociacionId, `privacidad.${clave}`, JSON.stringify(valor)]
      );
    }
  },
};

module.exports = PrivacidadModel;
