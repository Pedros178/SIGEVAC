/**
 * SIGEVAC — Datos de prueba (demo) para trabajar ya con el sistema.
 *
 * A diferencia de 001_seed_base.sql / run.js (que solo crean el mínimo
 * indispensable: catálogos, roles, permisos, UNA asociación y el usuario
 * super_admin), este script agrega un escenario completo y realista:
 *
 *  - Una SEGUNDA asociación civil (para probar multi-asociación de verdad)
 *  - Usuarios con cada uno de los 6 roles, repartidos entre ambas asociaciones
 *  - El super_admin queda agregado a las dos asociaciones (para ver el
 *    selector de asociación en la barra de navegación sin pasos extra)
 *  - 9 voluntarios (mayores, menores con tutor, uno inactivo) con expediente
 *    digital ya generado
 *  - Documentos en distintos estados: pendientes, cargados (para probar
 *    aprobar/rechazar), aprobados con vigencia próxima a vencer, vencidos,
 *    y aprobados con vigencia lejana — para poder probar el job de alertas
 *    de vigencia de inmediato, sin tener que cargar archivos a mano
 *  - Actividades pasadas y futuras, con inscripciones, entradas/salidas y
 *    horas de servicio acumuladas
 *
 * Requiere haber corrido antes `npm run db:setup` y `npm run db:seed`
 * (los seeds base). Es re-ejecutable de forma segura: si ya existe un
 * registro (por correo, por nombre de asociación, etc.) lo reutiliza en
 * vez de duplicarlo.
 *
 * Uso: node database/seeds/002_seed_demo.js   (o agrega "db:seed:demo" a package.json)
 */
require('dotenv').config();
// Estos datos son de DEMOSTRACIÓN (contraseña pública conocida, personas ficticias):
// nunca deben cargarse en una base de producción por accidente.
if (process.env.NODE_ENV === 'production' && process.env.PERMITIR_SEED_DEMO !== 'true') {
  console.error('❌ Seed de demostración bloqueado: NODE_ENV=production. Si de verdad lo necesitas, define PERMITIR_SEED_DEMO=true.');
  process.exit(1);
}

const path = require('path');
const bcrypt = require('bcryptjs');

const { pool, query } = require(path.join(__dirname, '../../src/config/database'));
const AsociacionModel = require(path.join(__dirname, '../../src/models/asociacionModel'));
const UsuarioModel = require(path.join(__dirname, '../../src/models/usuarioModel'));
const RolModel = require(path.join(__dirname, '../../src/models/rolModel'));
const VoluntarioModel = require(path.join(__dirname, '../../src/models/voluntarioModel'));
const TutorModel = require(path.join(__dirname, '../../src/models/tutorModel'));
const { ExpedienteModel, DocumentoModel } = require(path.join(__dirname, '../../src/models/expedienteModel'));
const ActividadModel = require(path.join(__dirname, '../../src/models/actividadModel'));
const ParticipacionModel = require(path.join(__dirname, '../../src/models/participacionModel'));
const HoraServicioModel = require(path.join(__dirname, '../../src/models/horaServicioModel'));

const PASSWORD_DEMO = 'Demo#2026';
const resumen = { usuarios: [], voluntarios: [], actividades: [] };

// --- utilidades ---
function hace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}
function en(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

async function obtenerOCrearAsociacion(datos) {
  const { rows } = await query(`SELECT * FROM asociaciones WHERE nombre = $1`, [datos.nombre]);
  if (rows[0]) return rows[0];
  return AsociacionModel.crear(datos);
}

async function obtenerOCrearUsuario({ nombre, correo, rol, asociacionId }) {
  let usuario = await UsuarioModel.buscarPorCorreo(correo);
  if (!usuario) {
    const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);
    usuario = await UsuarioModel.crear({ nombre, correo, passwordHash, asociacionId });
    const rolRow = await RolModel.buscarPorNombre(rol);
    await UsuarioModel.asignarRol(usuario.id, rolRow.id);
    resumen.usuarios.push({ correo, rol, asociacion: null });
  } else {
    // Aunque ya exista, nos aseguramos de que pertenezca a esta asociación.
    await UsuarioModel.asignarAsociacion(usuario.id, asociacionId, false);
  }
  return usuario;
}

async function obtenerMunicipio() {
  const { rows } = await query(`SELECT id, estado_id FROM municipios LIMIT 1`);
  return rows[0];
}

async function crearVoluntario({ asociacionId, nombre, apellidoPaterno, apellidoMaterno, fechaNacimiento, correo, sexo, municipioId, estadoId, tutor, tipoClave, inactivo }) {
  const existente = await query(`SELECT * FROM voluntarios WHERE correo = $1 AND asociacion_id = $2`, [correo, asociacionId]);
  let voluntario = existente.rows[0];
  let esNuevo = false;

  if (!voluntario) {
    voluntario = await VoluntarioModel.crear({
      asociacionId, nombre, apellidoPaterno, apellidoMaterno, fechaNacimiento,
      sexo, correo, municipioId, estadoId, nacionalidad: 'Mexicana',
    });
    esNuevo = true;
  }

  if (esNuevo) {
    if (tutor) await TutorModel.crear({ voluntarioId: voluntario.id, ...tutor });
    await ExpedienteModel.crearParaVoluntario(voluntario.id, voluntario.es_menor_edad, null);

    if (tipoClave) {
      const { rows: tipoRows } = await query(`SELECT id FROM tipos_voluntario WHERE clave = $1`, [tipoClave]);
      if (tipoRows[0]) {
        await query(
          `INSERT INTO voluntarios_tipos (voluntario_id, tipo_voluntario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [voluntario.id, tipoRows[0].id]
        );
      }
    }
    if (inactivo) {
      await query(`UPDATE voluntarios SET activo = false WHERE id = $1`, [voluntario.id]);
    }
  }

  resumen.voluntarios.push({ nombre: `${nombre} ${apellidoPaterno}`, menor: voluntario.es_menor_edad, asociacionId });
  return voluntario;
}

/** Aprueba (o deja "cargado") un documento del expediente de un voluntario por clave de tipo, con una vigencia dada. */
async function marcarDocumento(voluntarioId, claveTipo, { estado = 'aprobado', vigenciaHasta = null } = {}) {
  const { rows } = await query(
    `SELECT d.id FROM documentos d
     JOIN expedientes e ON e.id = d.expediente_id
     JOIN tipos_documento td ON td.id = d.tipo_documento_id
     WHERE e.voluntario_id = $1 AND td.clave = $2`,
    [voluntarioId, claveTipo]
  );
  const documento = rows[0];
  if (!documento) return null; // el tipo no aplica a este voluntario (p. ej. ine_tutor a un mayor)

  await DocumentoModel.marcarCargado(documento.id);
  if (estado === 'aprobado') {
    await DocumentoModel.actualizarEstado(documento.id, { estado: 'aprobado', vigenciaHasta });
  }
  return documento.id;
}

async function obtenerOCrearActividad(datos) {
  const { rows } = await query(
    `SELECT * FROM actividades WHERE nombre = $1 AND asociacion_id = $2`,
    [datos.nombre, datos.asociacionId]
  );
  if (rows[0]) return rows[0];
  return ActividadModel.crear(datos);
}

async function inscribirYRegistrarHoras(actividadId, voluntarioId, { horas, fecha }) {
  const { participacion } = await ParticipacionModel.inscribir(actividadId, voluntarioId);

  const { rows: existentes } = await query(`SELECT id FROM asistencias WHERE participacion_id = $1`, [participacion.id]);
  if (existentes.length > 0) return; // ya se había registrado en una corrida anterior del script

  const horaEntrada = fecha;
  const horaSalida = new Date(fecha.getTime() + horas * 60 * 60 * 1000);
  await query(
    `INSERT INTO asistencias (participacion_id, hora_entrada, hora_salida, horas_realizadas)
     VALUES ($1, $2, $3, $4)`,
    [participacion.id, horaEntrada, horaSalida, horas]
  );
  await HoraServicioModel.acumular(null, { voluntarioId, horas, fecha: horaEntrada });
}

async function main() {
  console.log('Creando escenario de datos de prueba para SIGEVAC (multi-asociación)...\n');

  // 1) Segunda asociación (la primera ya la crea 001_seed_base.sql)
  const asociacion1Row = await query(`SELECT * FROM asociaciones WHERE nombre ILIKE '%Sueños de Comedia%' LIMIT 1`);
  const asociacion1 = asociacion1Row.rows[0];
  if (!asociacion1) {
    throw new Error('No se encontró la asociación base. Corre primero "npm run db:seed".');
  }
  const asociacion2 = await obtenerOCrearAsociacion({
    nombre: 'Fundación Manos que Ayudan, A.C.',
    municipio: 'Tehuacán', estado: 'Puebla', correo: 'contacto@manosqueayudan.org',
    telefono: '2381234567', representante_legal: 'Laura Elena Vázquez Rojas',
  });
  console.log(`✅ Asociaciones: "${asociacion1.nombre}" y "${asociacion2.nombre}"`);

  // 2) Usuarios con cada rol
  const usuarios = {
    presidente: await obtenerOCrearUsuario({ nombre: 'Rosa Elena Martínez Pérez', correo: 'presidente1@demo.sigevac.mx', rol: 'presidente', asociacionId: asociacion1.id }),
    coordinador1: await obtenerOCrearUsuario({ nombre: 'Héctor Iván Domínguez Flores', correo: 'coordinador1@demo.sigevac.mx', rol: 'coordinador', asociacionId: asociacion1.id }),
    capturista: await obtenerOCrearUsuario({ nombre: 'Paola Ximena Salgado Reyes', correo: 'capturista1@demo.sigevac.mx', rol: 'capturista', asociacionId: asociacion1.id }),
    supervisor: await obtenerOCrearUsuario({ nombre: 'Diego Armando Castillo Luna', correo: 'supervisor1@demo.sigevac.mx', rol: 'supervisor', asociacionId: asociacion1.id }),
    consulta: await obtenerOCrearUsuario({ nombre: 'Fernanda Guadalupe Ibarra Solís', correo: 'consulta1@demo.sigevac.mx', rol: 'consulta', asociacionId: asociacion1.id }),
    coordinador2: await obtenerOCrearUsuario({ nombre: 'Alberto Josué Ramírez Cano', correo: 'coordinador2@demo.sigevac.mx', rol: 'coordinador', asociacionId: asociacion2.id }),
  };
  console.log(`✅ 6 usuarios de prueba creados/verificados (contraseña para todos: ${PASSWORD_DEMO})`);

  // El super_admin queda con acceso a ambas asociaciones, para ver el
  // selector de asociación sin tener que hacer nada más.
  const { rows: superAdmins } = await query(
    `SELECT u.id FROM usuarios u
     JOIN usuarios_roles ur ON ur.usuario_id = u.id
     JOIN roles r ON r.id = ur.rol_id
     WHERE r.nombre = 'super_admin' LIMIT 1`
  );
  if (superAdmins[0]) {
    await UsuarioModel.asignarAsociacion(superAdmins[0].id, asociacion1.id, true);
    await UsuarioModel.asignarAsociacion(superAdmins[0].id, asociacion2.id, false);
    console.log('✅ El usuario super_admin quedó agregado a ambas asociaciones.');
  }

  // 3) Voluntarios
  const municipio = await obtenerMunicipio();

  const v1 = await crearVoluntario({ asociacionId: asociacion1.id, nombre: 'Ana Karen', apellidoPaterno: 'López', apellidoMaterno: 'Hernández', fechaNacimiento: '1998-05-14', correo: 'ana.lopez@correo-demo.mx', sexo: 'F', municipioId: municipio.id, estadoId: municipio.estado_id, tipoClave: 'permanente' });
  const v2 = await crearVoluntario({ asociacionId: asociacion1.id, nombre: 'Miguel Ángel', apellidoPaterno: 'Torres', apellidoMaterno: 'Ramírez', fechaNacimiento: '2001-02-20', correo: 'miguel.torres@correo-demo.mx', sexo: 'M', municipioId: municipio.id, estadoId: municipio.estado_id, tipoClave: 'servicio_social' });
  const v3 = await crearVoluntario({ asociacionId: asociacion1.id, nombre: 'Daniela Sofía', apellidoPaterno: 'Cruz', apellidoMaterno: 'Martínez', fechaNacimiento: '2000-11-03', correo: 'daniela.cruz@correo-demo.mx', sexo: 'F', municipioId: municipio.id, estadoId: municipio.estado_id, tipoClave: 'residencia' });
  const v4 = await crearVoluntario({
    asociacionId: asociacion1.id, nombre: 'Emiliano', apellidoPaterno: 'Cruz', apellidoMaterno: 'Vázquez', fechaNacimiento: '2010-07-09', correo: 'tutor.emiliano@correo-demo.mx', sexo: 'M', municipioId: municipio.id, estadoId: municipio.estado_id,
    tutor: { nombre: 'María Guadalupe Vázquez Islas', curp: 'VAIG800101MPLZSL01', telefono: '2381112233', correo: 'tutor.emiliano@correo-demo.mx', parentesco: 'madre' },
  });
  await crearVoluntario({
    asociacionId: asociacion1.id, nombre: 'Regina Paola', apellidoPaterno: 'Sánchez', apellidoMaterno: 'Ibáñez', fechaNacimiento: '2011-01-25', correo: 'tutor.regina@correo-demo.mx', sexo: 'F', municipioId: municipio.id, estadoId: municipio.estado_id,
    tutor: { nombre: 'Roberto Carlos Sánchez Domínguez', curp: 'SADR750202HPLNMB05', telefono: '2384445566', correo: 'tutor.regina@correo-demo.mx', parentesco: 'padre' },
  });
  await crearVoluntario({ asociacionId: asociacion1.id, nombre: 'Jorge Iván', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Ortiz', fechaNacimiento: '1995-09-30', correo: 'jorge.mendoza@correo-demo.mx', sexo: 'M', municipioId: municipio.id, estadoId: municipio.estado_id, inactivo: true });

  const v7 = await crearVoluntario({ asociacionId: asociacion2.id, nombre: 'Fernanda Itzel', apellidoPaterno: 'Rojas', apellidoMaterno: 'Delgado', fechaNacimiento: '1999-04-18', correo: 'fernanda.rojas@correo-demo.mx', sexo: 'F', municipioId: municipio.id, estadoId: municipio.estado_id, tipoClave: 'permanente' });
  const v8 = await crearVoluntario({ asociacionId: asociacion2.id, nombre: 'Luis Andrés', apellidoPaterno: 'Palacios', apellidoMaterno: 'Nava', fechaNacimiento: '1997-12-11', correo: 'luis.palacios@correo-demo.mx', sexo: 'M', municipioId: municipio.id, estadoId: municipio.estado_id, tipoClave: 'temporal' });
  await crearVoluntario({
    asociacionId: asociacion2.id, nombre: 'Camila Abigail', apellidoPaterno: 'Torres', apellidoMaterno: 'Gómez', fechaNacimiento: '2009-06-22', correo: 'tutor.camila@correo-demo.mx', sexo: 'F', municipioId: municipio.id, estadoId: municipio.estado_id,
    tutor: { nombre: 'Adriana Torres Bautista', curp: 'TOBA820303MPLRTD04', telefono: '2387778899', correo: 'tutor.camila@correo-demo.mx', parentesco: 'madre' },
  });
  console.log(`✅ 9 voluntarios de prueba creados/verificados (6 en "${asociacion1.nombre}", 3 en "${asociacion2.nombre}")`);

  // 4) Documentos: variedad de estados para probar semáforo y alertas de vigencia
  // v1: expediente casi completo, con un documento por vencer pronto (10 días) -> el job debe alertarlo
  await marcarDocumento(v1.id, 'curp', { estado: 'aprobado' });
  await marcarDocumento(v1.id, 'ine', { estado: 'aprobado', vigenciaHasta: en(10) });
  await marcarDocumento(v1.id, 'comprobante_domicilio', { estado: 'aprobado', vigenciaHasta: en(200) });
  await marcarDocumento(v1.id, 'seguro', { estado: 'aprobado', vigenciaHasta: en(400) });
  await marcarDocumento(v1.id, 'ficha_voluntariado', { estado: 'aprobado' });
  await marcarDocumento(v1.id, 'carta_responsiva', { estado: 'aprobado' });
  await marcarDocumento(v1.id, 'aviso_privacidad', { estado: 'aprobado' });
  await marcarDocumento(v1.id, 'reglamento_interno', { estado: 'aprobado' });
  await marcarDocumento(v1.id, 'uso_imagen', { estado: 'aprobado' });

  // v2: documento YA VENCIDO -> el job también debe alertarlo (y marcarlo como vencido en el correo)
  await marcarDocumento(v2.id, 'curp', { estado: 'aprobado' });
  await marcarDocumento(v2.id, 'ine', { estado: 'aprobado', vigenciaHasta: en(-5) });
  await marcarDocumento(v2.id, 'comprobante_domicilio', { estado: 'cargado' }); // pendiente de aprobar

  // v3: expediente con un documento RECHAZADO
  await marcarDocumento(v3.id, 'curp', { estado: 'aprobado' });
  const rechazadoId = await marcarDocumento(v3.id, 'seguro', { estado: 'cargado' });
  if (rechazadoId) await DocumentoModel.actualizarEstado(rechazadoId, { estado: 'rechazado', observaciones: 'La póliza subida está vencida, favor de actualizarla.' });

  // v4 (menor): documentos del tutor, uno con vigencia lejana (no debe alertar)
  await marcarDocumento(v4.id, 'curp', { estado: 'aprobado' });
  await marcarDocumento(v4.id, 'ine_tutor', { estado: 'aprobado', vigenciaHasta: en(300) });
  await marcarDocumento(v4.id, 'carta_autorizacion', { estado: 'aprobado' });

  // v5 (menor): expediente apenas iniciado (todo pendiente) -> semáforo rojo
  // (no se marca nada a propósito)

  // v7/v8 (asociación 2): variedad también, para probar que el job y los
  // reportes respetan el aislamiento por asociación
  await marcarDocumento(v7.id, 'curp', { estado: 'aprobado' });
  await marcarDocumento(v7.id, 'ine', { estado: 'aprobado', vigenciaHasta: en(15) });
  await marcarDocumento(v8.id, 'curp', { estado: 'cargado' });

  console.log('✅ Documentos de expediente cargados con distintos estados (pendiente, cargado, aprobado, rechazado, vencido, por vencer)');

  // 5) Actividades + participación + horas
  const actPasada1 = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Taller de improvisación teatral', fecha: fechaISO(hace(20)),
    lugar: 'Casa de la Cultura de Tehuacán', responsableId: usuarios.coordinador1.id, cupo: 25,
    descripcion: 'Taller introductorio de improvisación para voluntarios nuevos.',
  });
  const actPasada2 = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Función benéfica de comedia', fecha: fechaISO(hace(7)),
    lugar: 'Auditorio Municipal', responsableId: usuarios.coordinador1.id, cupo: 40,
    descripcion: 'Función abierta al público para recaudar fondos.',
  });
  const actFutura = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Capacitación de nuevos voluntarios', fecha: en(15),
    lugar: 'Oficinas de la asociación', responsableId: usuarios.coordinador1.id, cupo: 15,
    descripcion: 'Inducción para el voluntariado que se incorporó este mes.',
  });
  const actAsoc2 = await obtenerOCrearActividad({
    asociacionId: asociacion2.id, nombre: 'Jornada de apoyo comunitario', fecha: fechaISO(hace(3)),
    lugar: 'Plaza principal', responsableId: usuarios.coordinador2.id, cupo: 30,
    descripcion: 'Actividad de la Fundación Manos que Ayudan.',
  });
  resumen.actividades.push(actPasada1.nombre, actPasada2.nombre, actFutura.nombre, actAsoc2.nombre);

  await inscribirYRegistrarHoras(actPasada1.id, v1.id, { horas: 4, fecha: hace(20) });
  await inscribirYRegistrarHoras(actPasada1.id, v2.id, { horas: 4, fecha: hace(20) });
  await inscribirYRegistrarHoras(actPasada1.id, v3.id, { horas: 3.5, fecha: hace(20) });
  await inscribirYRegistrarHoras(actPasada2.id, v1.id, { horas: 5, fecha: hace(7) });
  await inscribirYRegistrarHoras(actPasada2.id, v3.id, { horas: 5, fecha: hace(7) });
  await ParticipacionModel.inscribir(actFutura.id, v4.id); // inscrito, sin asistencia todavía (actividad futura)
  await inscribirYRegistrarHoras(actAsoc2.id, v7.id, { horas: 3, fecha: hace(3) });
  await inscribirYRegistrarHoras(actAsoc2.id, v8.id, { horas: 3, fecha: hace(3) });

  console.log('✅ Actividades, participaciones y horas de servicio registradas.\n');

  console.log('======================================================');
  console.log(' RESUMEN — credenciales para probar cada rol');
  console.log('======================================================');
  console.log(`Contraseña para TODOS los usuarios de prueba: ${PASSWORD_DEMO}\n`);
  console.log(`  presidente1@demo.sigevac.mx     → presidente (${asociacion1.nombre})`);
  console.log(`  coordinador1@demo.sigevac.mx    → coordinador (${asociacion1.nombre})`);
  console.log(`  capturista1@demo.sigevac.mx     → capturista (${asociacion1.nombre})`);
  console.log(`  supervisor1@demo.sigevac.mx     → supervisor (${asociacion1.nombre})`);
  console.log(`  consulta1@demo.sigevac.mx       → consulta (${asociacion1.nombre})`);
  console.log(`  coordinador2@demo.sigevac.mx    → coordinador (${asociacion2.nombre})`);
  console.log('\nTu super_admin ya quedó agregado a ambas asociaciones: al iniciar');
  console.log('sesión con él verás el selector de asociación en la barra superior.');
  console.log('\nPara ver la alerta de vigencia en acción: entra a Administración >');
  console.log('Configuración y da clic en "Revisar vigencias ahora" — debe encontrar');
  console.log('al menos 2 documentos (uno por vencer en 10 días, uno ya vencido).');
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Error generando datos de prueba:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
