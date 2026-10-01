const { esCorreoValido } = require('./validadores');
const { fechaValida, calcularEdad } = require('./edad');

// Longitudes máximas = las de las columnas de la tabla `voluntarios`
// (antes un texto más largo llegaba hasta PostgreSQL y devolvía 500).
const LIMITES = {
  numeroControl: 40, nombre: 150, apellidoPaterno: 100, apellidoMaterno: 100, curp: 18, sexo: 20,
  estadoCivil: 30, nacionalidad: 60, telefono: 20, telefonoFijo: 20, telefonoCelular: 20,
  direccion: 300, colonia: 150, codigoPostal: 10, tipoSangre: 10, alergias: 2000,
  discapacidad: 200, enfermedadCronica: 200, estado: 120, municipio: 120,
  contactoEmergenciaNombre: 150, contactoEmergenciaTelefono: 20, contactoEmergenciaParentesco: 60,
  contactoEmergenciaDomicilio: 300, contactoEmergenciaColonia: 150, contactoEmergenciaMunicipio: 120,
  contactoEmergenciaEstado: 120, contactoEmergenciaTelefonoFijo: 20, contactoEmergenciaTelefonoCelular: 20,
};
const CAMPOS_CORREO = ['correo', 'contactoEmergenciaCorreo'];
const CAMPOS_FECHA = ['fechaNacimiento', 'fechaIngreso', 'fechaBaja'];

/**
 * Valida los datos de un voluntario (alta, edición o fila de importación).
 * Devuelve un mensaje de error en español o `null` si todo es válido.
 * Con `{ parcial: true }` (edición) los campos obligatorios no son requeridos.
 */
function validarDatosVoluntario(datos, { parcial = false } = {}) {
  if (!datos || typeof datos !== 'object') return 'Datos inválidos.';

  if (!parcial || datos.nombre !== undefined) {
    if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) return 'El nombre es obligatorio.';
  }
  if (!parcial || datos.fechaNacimiento !== undefined) {
    if (!datos.fechaNacimiento) return 'La fecha de nacimiento es obligatoria.';
  }

  for (const [campo, maximo] of Object.entries(LIMITES)) {
    const valor = datos[campo];
    if (valor === undefined || valor === null) continue;
    if (typeof valor !== 'string') return `${campo} debe ser texto.`;
    if (valor.length > maximo) return `${campo} no puede exceder ${maximo} caracteres.`;
  }
  for (const campo of CAMPOS_CORREO) {
    const valor = datos[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    if (!esCorreoValido(valor) || valor.length > 150) return `${campo} no tiene un formato de correo válido.`;
  }
  for (const campo of CAMPOS_FECHA) {
    const valor = datos[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    if (!fechaValida(valor)) return `${campo} no es una fecha válida (usa AAAA-MM-DD).`;
  }
  if (datos.fechaNacimiento) {
    const edad = calcularEdad(datos.fechaNacimiento);
    if (edad === null || edad < 0) return 'La fecha de nacimiento no puede ser futura.';
    if (edad > 120) return 'La fecha de nacimiento no es realista.';
  }
  if (datos.tiposVoluntario !== undefined && (!Array.isArray(datos.tiposVoluntario) || datos.tiposVoluntario.some((t) => typeof t !== 'string'))) {
    return 'tiposVoluntario debe ser una lista de claves de texto.';
  }
  if (datos.tutor !== undefined && datos.tutor !== null) {
    if (typeof datos.tutor !== 'object' || (datos.tutor.nombre !== undefined && typeof datos.tutor.nombre !== 'string')) return 'Los datos del tutor son inválidos.';
    if ((datos.tutor.nombre || '').length > 150) return 'El nombre del tutor no puede exceder 150 caracteres.';
  }
  return null;
}

module.exports = { validarDatosVoluntario };
