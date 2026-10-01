/**
 * SIGEVAC — Datos de prueba (demo) para Inventario, Cuotas, Gamificación
 * y Solicitudes de voluntariado.
 *
 * 001_seed_base.sql / run.js crean lo mínimo (catálogos, roles, permisos,
 * una asociación, el super_admin). 002_seed_demo.js agrega voluntarios,
 * expedientes, actividades y horas de servicio. Este script llena los
 * módulos que ninguno de los dos anteriores toca:
 *
 *  - Inventario: categorías/subcategorías (Vestuario, Arte y Cultura,
 *    Insumos), artículos con estado físico y ubicación variados,
 *    movimientos de entrada/salida (incluyendo uno que deja un artículo
 *    por debajo de su mínimo), préstamos (uno vigente, uno atrasado, uno
 *    ya devuelto) y mantenimientos con costo.
 *  - Cuotas: dos cuotas activas con pagos parciales (para ver quién debe
 *    y quién ya pagó).
 *  - Gamificación: agrega actividades y horas extra a un par de
 *    voluntarios para que crucen varios umbrales, y evalúa/otorga sus
 *    insignias (el catálogo de insignias ya lo crea la migración 012).
 *  - Solicitudes de voluntariado: varias en distintos estados
 *    (pendiente, aprobada, rechazada), como si vinieran del formulario
 *    público.
 *
 * Requiere haber corrido antes, en orden:
 *   npm run db:setup
 *   npm run db:seed
 *   npm run db:seed:demo
 * Es re-ejecutable de forma segura: reutiliza registros existentes por
 * nombre/código en vez de duplicarlos.
 *
 * Uso: node database/seeds/003_seed_inventario_demo.js
 * (o agrega "db:seed:inventario": "node database/seeds/003_seed_inventario_demo.js" a package.json)
 */
require('dotenv').config();
// Estos datos son de DEMOSTRACIÓN (contraseña pública conocida, personas ficticias):
// nunca deben cargarse en una base de producción por accidente.
if (process.env.NODE_ENV === 'production' && process.env.PERMITIR_SEED_DEMO !== 'true') {
  console.error('❌ Seed de demostración bloqueado: NODE_ENV=production. Si de verdad lo necesitas, define PERMITIR_SEED_DEMO=true.');
  process.exit(1);
}

const path = require('path');

const { pool, query } = require(path.join(__dirname, '../../src/config/database'));
const ActividadModel = require(path.join(__dirname, '../../src/models/actividadModel'));
const ParticipacionModel = require(path.join(__dirname, '../../src/models/participacionModel'));
const HoraServicioModel = require(path.join(__dirname, '../../src/models/horaServicioModel'));
const InventarioCategoriaModel = require(path.join(__dirname, '../../src/models/inventarioCategoriaModel'));
const InventarioModel = require(path.join(__dirname, '../../src/models/inventarioModel'));
const InventarioPrestamoModel = require(path.join(__dirname, '../../src/models/inventarioPrestamoModel'));
const InventarioMantenimientoModel = require(path.join(__dirname, '../../src/models/inventarioMantenimientoModel'));
const CuotaModel = require(path.join(__dirname, '../../src/models/cuotaModel'));
const SolicitudModel = require(path.join(__dirname, '../../src/models/solicitudModel'));
const { evaluarInsignias } = require(path.join(__dirname, '../../src/services/gamificacionService'));

// --- utilidades (mismo patrón que 002_seed_demo.js) ---
function hace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}
function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}
function hoyMas(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fechaISO(d);
}

async function obtenerAsociacionPorNombre(fragmento) {
  const { rows } = await query(`SELECT * FROM asociaciones WHERE nombre ILIKE $1 LIMIT 1`, [`%${fragmento}%`]);
  if (!rows[0]) throw new Error(`No se encontró la asociación "${fragmento}". Corre primero db:seed y db:seed:demo.`);
  return rows[0];
}

async function obtenerVoluntarioPorCorreo(correo) {
  const { rows } = await query(`SELECT * FROM voluntarios WHERE correo = $1`, [correo]);
  if (!rows[0]) throw new Error(`No se encontró el voluntario "${correo}". Corre primero db:seed:demo.`);
  return rows[0];
}

async function obtenerUsuarioPorCorreo(correo) {
  const { rows } = await query(`SELECT * FROM usuarios WHERE correo = $1`, [correo]);
  return rows[0] || null;
}

async function obtenerOCrearCategoria({ asociacionId, nombre, categoriaPadreId = null }) {
  const { rows } = await query(
    `SELECT * FROM inventario_categorias WHERE asociacion_id = $1 AND nombre = $2 AND categoria_padre_id IS NOT DISTINCT FROM $3`,
    [asociacionId, nombre, categoriaPadreId]
  );
  if (rows[0]) return rows[0];
  return InventarioCategoriaModel.crear({ asociacionId, nombre, categoriaPadreId });
}

async function obtenerOCrearArticulo({ asociacionId, nombre, ...resto }) {
  const { rows } = await query(`SELECT * FROM inventario_articulos WHERE asociacion_id = $1 AND nombre = $2`, [asociacionId, nombre]);
  if (rows[0]) return { articulo: rows[0], esNuevo: false };
  const articulo = await InventarioModel.crear({ asociacionId, nombre, ...resto });
  return { articulo, esNuevo: true };
}

async function obtenerOCrearActividad(datos) {
  const { rows } = await query(`SELECT * FROM actividades WHERE nombre = $1 AND asociacion_id = $2`, [datos.nombre, datos.asociacionId]);
  if (rows[0]) return rows[0];
  return ActividadModel.crear(datos);
}

async function inscribirYRegistrarHoras(actividadId, voluntarioId, { horas, fecha }) {
  const { participacion } = await ParticipacionModel.inscribir(actividadId, voluntarioId);
  const { rows: existentes } = await query(`SELECT id FROM asistencias WHERE participacion_id = $1`, [participacion.id]);
  if (existentes.length > 0) return;
  const horaSalida = new Date(fecha.getTime() + horas * 60 * 60 * 1000);
  await query(
    `INSERT INTO asistencias (participacion_id, hora_entrada, hora_salida, horas_realizadas) VALUES ($1, $2, $3, $4)`,
    [participacion.id, fecha, horaSalida, horas]
  );
  await HoraServicioModel.acumular(null, { voluntarioId, horas, fecha });
}

async function main() {
  console.log('Agregando datos de prueba: Inventario, Cuotas, Gamificación y Solicitudes...\n');

  const asociacion1 = await obtenerAsociacionPorNombre('Sueños de Comedia');
  const asociacion2 = await obtenerAsociacionPorNombre('Manos que Ayudan');
  const coordinador1 = await obtenerUsuarioPorCorreo('coordinador1@demo.sigevac.mx');

  const v1 = await obtenerVoluntarioPorCorreo('ana.lopez@correo-demo.mx');
  const v2 = await obtenerVoluntarioPorCorreo('miguel.torres@correo-demo.mx');
  const v3 = await obtenerVoluntarioPorCorreo('daniela.cruz@correo-demo.mx');

  // ============================================================
  // 1) INVENTARIO
  // ============================================================
  const catVestuario = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Vestuario' });
  const subSombreros = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Sombreros', categoriaPadreId: catVestuario.id });
  const subTrajes = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Trajes', categoriaPadreId: catVestuario.id });

  const catArte = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Arte y Cultura' });
  const subEscenografia = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Escenografía', categoriaPadreId: catArte.id });
  const subUtileria = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Utilería', categoriaPadreId: catArte.id });

  const catInsumos = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Insumos' });
  const subConsumibles = await obtenerOCrearCategoria({ asociacionId: asociacion1.id, nombre: 'Consumibles', categoriaPadreId: catInsumos.id });

  console.log('✅ Categorías de inventario: Vestuario (Sombreros, Trajes), Arte y Cultura (Escenografía, Utilería), Insumos (Consumibles)');

  const { articulo: sombrerosCopa, esNuevo: nSombreros } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Sombreros de copa', descripcion: 'Set de sombreros de copa para números musicales.',
    unidad: 'pieza', minimo: 5, categoriaId: catVestuario.id, subcategoriaId: subSombreros.id,
    estadoFisico: 'bueno', ubicacion: 'Bodega A - Estante 2', esPrestable: true,
  });
  const { articulo: trajeArlequin, esNuevo: nArlequin } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Traje de arlequín', descripcion: 'Traje completo de arlequín, talla M.',
    unidad: 'pieza', minimo: 2, categoriaId: catVestuario.id, subcategoriaId: subTrajes.id,
    estadoFisico: 'regular', ubicacion: 'Bodega A - Percha 5', esPrestable: true,
  });
  const { articulo: telonFondo, esNuevo: nTelon } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Telón de fondo azul', descripcion: 'Telón de terciopelo azul, 4x6 m.',
    unidad: 'pieza', minimo: 1, categoriaId: catArte.id, subcategoriaId: subEscenografia.id,
    estadoFisico: 'bueno', ubicacion: 'Bodega B - Colgado', esPrestable: true,
  });
  const { articulo: espadasUtileria, esNuevo: nEspadas } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Espadas de utilería', descripcion: 'Espadas de plástico rígido para escenas de esgrima.',
    unidad: 'pieza', minimo: 6, categoriaId: catArte.id, subcategoriaId: subUtileria.id,
    estadoFisico: 'bueno', ubicacion: 'Bodega B - Caja 3', esPrestable: true,
  });
  const { articulo: maquillajeTeatral, esNuevo: nMaquillaje } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Maquillaje teatral (kit)', descripcion: 'Kits de maquillaje para caracterización.',
    unidad: 'kit', minimo: 3, categoriaId: catInsumos.id, subcategoriaId: subConsumibles.id,
    estadoFisico: 'bueno', ubicacion: 'Oficina - Cajón 1', esPrestable: false,
  });
  const { articulo: sillasPlegables, esNuevo: nSillas } = await obtenerOCrearArticulo({
    asociacionId: asociacion1.id, nombre: 'Sillas plegables', descripcion: 'Sillas para montaje de auditorio improvisado.',
    unidad: 'pieza', minimo: 20, categoriaId: catArte.id, subcategoriaId: subEscenografia.id,
    estadoFisico: 'dañado', ubicacion: 'Bodega B - Fondo', esPrestable: false,
  });
  console.log('✅ 6 artículos de inventario creados/verificados (vestuario, escenografía, utilería, insumos)');

  // Segunda asociación: un par de artículos propios, para probar que el
  // aislamiento por asociación también se ve bien en la UI (cada una ve
  // solo lo suyo).
  const catManos = await obtenerOCrearCategoria({ asociacionId: asociacion2.id, nombre: 'Insumos' });
  await obtenerOCrearArticulo({
    asociacionId: asociacion2.id, nombre: 'Despensas básicas', descripcion: 'Paquetes de despensa para jornadas de apoyo.',
    unidad: 'paquete', minimo: 10, categoriaId: catManos.id, estadoFisico: 'bueno', ubicacion: 'Bodega principal', esPrestable: false,
  });
  console.log('✅ Artículo de inventario de prueba en la segunda asociación (aislamiento)');

  // Movimientos: solo si los artículos son nuevos en esta corrida, para
  // no ir sumando existencias cada vez que se re-ejecute el script.
  if (nSombreros) {
    await InventarioModel.movimiento({ articuloId: sombrerosCopa.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 8, motivo: 'Compra inicial de vestuario' });
  }
  if (nArlequin) {
    await InventarioModel.movimiento({ articuloId: trajeArlequin.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 3, motivo: 'Compra inicial de vestuario' });
  }
  if (nTelon) {
    await InventarioModel.movimiento({ articuloId: telonFondo.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 2, motivo: 'Donación de la Casa de Cultura' });
  }
  if (nEspadas) {
    await InventarioModel.movimiento({ articuloId: espadasUtileria.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 10, motivo: 'Compra inicial' });
    // Salida que deja el artículo por debajo de su mínimo (6), para probar
    // la señal de "stock bajo" en el panel de inventario.
    await InventarioModel.movimiento({ articuloId: espadasUtileria.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'salida', cantidad: 6, motivo: 'Se extraviaron en bodega durante la mudanza' });
  }
  if (nMaquillaje) {
    await InventarioModel.movimiento({ articuloId: maquillajeTeatral.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 5, motivo: 'Compra inicial' });
  }
  if (nSillas) {
    await InventarioModel.movimiento({ articuloId: sillasPlegables.id, asociacionId: asociacion1.id, usuarioId: coordinador1.id, tipo: 'entrada', cantidad: 30, motivo: 'Compra inicial' });
  }
  console.log('✅ Movimientos de entrada/salida registrados (incluye un artículo por debajo de su mínimo)');

  // Fotos de artículos: se omiten a propósito. Requieren subir un archivo
  // real (multipart) al endpoint /inventario/:id/fotos; no tiene sentido
  // fabricar uno aquí. Pruébalo manualmente desde la ficha del artículo.

  // Préstamos: uno vigente, uno atrasado, uno ya devuelto.
  const { rows: prestamosExistentes } = await query(`SELECT articulo_id, estado FROM inventario_prestamos WHERE asociacion_id = $1`, [asociacion1.id]);
  const yaTienePrestamo = (articuloId, estado) => prestamosExistentes.some((p) => p.articulo_id === articuloId && p.estado === estado);

  if (!yaTienePrestamo(sombrerosCopa.id, 'prestado')) {
    await InventarioPrestamoModel.crear({
      asociacionId: asociacion1.id, articuloId: sombrerosCopa.id, cantidad: 2,
      responsable: 'Ana Karen López Hernández', contacto: 'ana.lopez@correo-demo.mx',
      motivo: 'Función benéfica de comedia', fechaDevolucionProgramada: hoyMas(5),
      condicionEntrega: 'Buen estado, sin manchas.', registradoPor: coordinador1.id, voluntarioId: v1.id,
    });
  }
  if (!yaTienePrestamo(trajeArlequin.id, 'prestado')) {
    await InventarioPrestamoModel.crear({
      asociacionId: asociacion1.id, articuloId: trajeArlequin.id, cantidad: 1,
      responsable: 'Miguel Ángel Torres Ramírez', contacto: '2381112233',
      motivo: 'Ensayo general', fechaDevolucionProgramada: hoyMas(-3), // ya venció -> se ve "Atrasado"
      condicionEntrega: 'Costura del cuello ligeramente floja.', registradoPor: coordinador1.id, voluntarioId: v2.id,
    });
  }
  if (!yaTienePrestamo(espadasUtileria.id, 'devuelto') && !yaTienePrestamo(espadasUtileria.id, 'prestado')) {
    const devuelto = await InventarioPrestamoModel.crear({
      asociacionId: asociacion1.id, articuloId: espadasUtileria.id, cantidad: 2,
      responsable: 'Daniela Sofía Cruz Martínez', contacto: 'daniela.cruz@correo-demo.mx',
      motivo: 'Taller de improvisación teatral', fechaDevolucionProgramada: fechaISO(hace(1)),
      condicionEntrega: 'Nuevas.', registradoPor: coordinador1.id, voluntarioId: v3.id,
    });
    await InventarioPrestamoModel.devolver({ id: devuelto.id, asociacionId: asociacion1.id, condicionRetorno: 'Una espada con la punta despostillada.', estadoFisicoResultante: 'regular' });
  }
  console.log('✅ Préstamos de inventario: uno vigente, uno atrasado y uno ya devuelto');

  // Mantenimientos
  const { rows: mantenimientosExistentes } = await query(`SELECT id FROM inventario_mantenimientos WHERE articulo_id = $1`, [sillasPlegables.id]);
  if (mantenimientosExistentes.length === 0) {
    await InventarioMantenimientoModel.crear({
      articuloId: sillasPlegables.id, tipo: 'Reparación', descripcion: 'Se soldaron 4 sillas con la estructura doblada.',
      fecha: fechaISO(hace(15)), responsable: 'Taller El Buen Soldador', costo: 480, registradoPor: coordinador1.id,
    });
  }
  const { rows: mantTelon } = await query(`SELECT id FROM inventario_mantenimientos WHERE articulo_id = $1`, [telonFondo.id]);
  if (mantTelon.length === 0) {
    await InventarioMantenimientoModel.crear({
      articuloId: telonFondo.id, tipo: 'Limpieza', descripcion: 'Lavado en seco después de la función benéfica.',
      fecha: fechaISO(hace(6)), responsable: 'Tintorería Martínez', costo: 250, registradoPor: coordinador1.id,
    });
  }
  console.log('✅ Mantenimientos registrados (con costo, para el reporte de gastos de inventario)\n');

  // ============================================================
  // 2) CUOTAS
  // ============================================================
  const { rows: cuotasExistentes } = await query(`SELECT * FROM cuotas WHERE asociacion_id = $1`, [asociacion1.id]);
  let cuotaMensual = cuotasExistentes.find((c) => c.nombre === 'Cuota mensual ordinaria');
  if (!cuotaMensual) {
    cuotaMensual = await CuotaModel.crear({ asociacionId: asociacion1.id, nombre: 'Cuota mensual ordinaria', monto: 150, periodo: 'mensual', fechaVencimiento: hoyMas(10) });
  }
  let cuotaVestuario = cuotasExistentes.find((c) => c.nombre === 'Cuota extraordinaria - vestuario nuevo');
  if (!cuotaVestuario) {
    cuotaVestuario = await CuotaModel.crear({ asociacionId: asociacion1.id, nombre: 'Cuota extraordinaria - vestuario nuevo', monto: 300, periodo: 'única', fechaVencimiento: hoyMas(30) });
  }

  const { rows: pagosExistentes } = await query(`SELECT voluntario_id, cuota_id FROM pagos_cuotas WHERE cuota_id = ANY($1)`, [[cuotaMensual.id, cuotaVestuario.id]]);
  const yaPago = (cuotaId, voluntarioId) => pagosExistentes.some((p) => p.cuota_id === cuotaId && p.voluntario_id === voluntarioId);

  // v1 y v3 ya pagaron la mensual; v2 todavía no (para ver la lista de
  // adeudos). Solo v1 pagó la extraordinaria.
  if (!yaPago(cuotaMensual.id, v1.id)) await CuotaModel.registrarPago({ cuotaId: cuotaMensual.id, voluntarioId: v1.id, monto: 150, metodo: 'transferencia', referencia: 'TRX-00123', usuarioId: coordinador1.id });
  if (!yaPago(cuotaMensual.id, v3.id)) await CuotaModel.registrarPago({ cuotaId: cuotaMensual.id, voluntarioId: v3.id, monto: 150, metodo: 'efectivo', usuarioId: coordinador1.id });
  if (!yaPago(cuotaVestuario.id, v1.id)) await CuotaModel.registrarPago({ cuotaId: cuotaVestuario.id, voluntarioId: v1.id, monto: 300, metodo: 'efectivo', usuarioId: coordinador1.id });
  console.log('✅ Cuotas creadas con pagos parciales (Miguel Ángel queda pendiente de la mensual, a propósito)\n');

  // ============================================================
  // 3) GAMIFICACIÓN — más actividades/horas para v1 y v3, y evaluación
  //    de insignias de los 3 voluntarios usados en este script.
  // ============================================================
  const actExtra1 = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Función de fin de temporada', fecha: fechaISO(hace(45)),
    lugar: 'Teatro del Pueblo', responsableId: coordinador1.id, cupo: 50, descripcion: 'Cierre de temporada con función abierta.',
  });
  const actExtra2 = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Taller de máscaras y utilería', fecha: fechaISO(hace(30)),
    lugar: 'Oficinas de la asociación', responsableId: coordinador1.id, cupo: 20, descripcion: 'Elaboración de utilería para la próxima obra.',
  });
  const actExtra3 = await obtenerOCrearActividad({
    asociacionId: asociacion1.id, nombre: 'Gira comunitaria - Barrio de la Luz', fecha: fechaISO(hace(60)),
    lugar: 'Barrio de la Luz', responsableId: coordinador1.id, cupo: 30, descripcion: 'Función itinerante en comunidad.',
  });

  // v1: la empujamos por encima de 50 horas (veterano_50h) y 5 actividades (activo_5act).
  await inscribirYRegistrarHoras(actExtra1.id, v1.id, { horas: 20, fecha: hace(45) });
  await inscribirYRegistrarHoras(actExtra2.id, v1.id, { horas: 12, fecha: hace(30) });
  await inscribirYRegistrarHoras(actExtra3.id, v1.id, { horas: 10, fecha: hace(60) });

  // v3: la empujamos a 5 actividades completadas (activo_5act), sin llegar a veterana.
  await inscribirYRegistrarHoras(actExtra1.id, v3.id, { horas: 4, fecha: hace(45) });
  await inscribirYRegistrarHoras(actExtra2.id, v3.id, { horas: 3, fecha: hace(30) });
  await inscribirYRegistrarHoras(actExtra3.id, v3.id, { horas: 3, fecha: hace(60) });

  console.log('✅ Actividades y horas adicionales registradas para acercar a los voluntarios a más insignias');

  const insigniasOtorgadas = [];
  for (const [nombre, voluntario] of [['Ana Karen', v1], ['Miguel Ángel', v2], ['Daniela Sofía', v3]]) {
    const nuevas = await evaluarInsignias(voluntario.id);
    if (nuevas.length > 0) insigniasOtorgadas.push(`${nombre}: ${nuevas.map((i) => i.nombre).join(', ')}`);
  }
  console.log(insigniasOtorgadas.length > 0
    ? `✅ Insignias otorgadas:\n   - ${insigniasOtorgadas.join('\n   - ')}`
    : 'ℹ️  No se otorgaron insignias nuevas (probablemente ya se habían otorgado en una corrida anterior).');
  console.log();

  // ============================================================
  // 4) SOLICITUDES DE VOLUNTARIADO (formulario público)
  // ============================================================
  const { rows: solicitudesExistentes } = await query(`SELECT correo FROM solicitudes_voluntariado WHERE asociacion_id = $1`, [asociacion1.id]);
  const correosConSolicitud = new Set(solicitudesExistentes.map((s) => s.correo));

  const solicitudesDemo = [
    { correo: 'valeria.mendez@correo-demo.mx', nombre: 'Valeria Méndez Ríos', telefono: '2381230001', mensaje: 'Me interesa apoyar en las funciones de fin de semana, tengo experiencia en teatro escolar.' },
    { correo: 'oscar.reyes@correo-demo.mx', nombre: 'Óscar Reyes Campos', telefono: '2381230002', mensaje: 'Soy estudiante de escenografía y quisiera hacer mi servicio social con ustedes.' },
    { correo: 'brenda.solis@correo-demo.mx', nombre: 'Brenda Solís Aguilar', telefono: '', mensaje: 'Quiero saber si aceptan voluntarios los fines de semana solamente.' },
  ];

  for (const s of solicitudesDemo) {
    if (!correosConSolicitud.has(s.correo)) {
      await SolicitudModel.crear({ asociacionId: asociacion1.id, ...s });
    }
  }

  // Deja una en "pendiente" (la default), aprueba otra y rechaza otra,
  // para ver los tres estados en la bandeja de Administración.
  const { rows: listaSolicitudes } = await query(`SELECT * FROM solicitudes_voluntariado WHERE asociacion_id = $1 ORDER BY creado_en ASC`, [asociacion1.id]);
  const solOscar = listaSolicitudes.find((s) => s.correo === 'oscar.reyes@correo-demo.mx');
  const solBrenda = listaSolicitudes.find((s) => s.correo === 'brenda.solis@correo-demo.mx');
  if (solOscar && solOscar.estado === 'pendiente') await SolicitudModel.actualizarEstado(solOscar.id, asociacion1.id, 'aprobada', coordinador1.id);
  if (solBrenda && solBrenda.estado === 'pendiente') await SolicitudModel.actualizarEstado(solBrenda.id, asociacion1.id, 'rechazada', coordinador1.id);

  console.log('✅ Solicitudes de voluntariado: una pendiente, una aprobada y una rechazada\n');

  console.log('======================================================');
  console.log(' LISTO — ya puedes explorar Inventario, Cuotas,');
  console.log(' Gamificación y Solicitudes con datos reales.');
  console.log('======================================================');
  console.log('Usa cualquiera de los usuarios que imprimió db:seed:demo,');
  console.log('por ejemplo coordinador1@demo.sigevac.mx / Demo#2026');
  console.log('(tiene permiso de gestión en todos estos módulos).');
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Error generando datos de prueba de inventario/cuotas/gamificación:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
