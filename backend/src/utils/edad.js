/**
 * Utilidades de fechas de nacimiento. Las fechas llegan como 'YYYY-MM-DD'
 * (sin hora ni zona): se interpretan por sus componentes, NO con
 * `new Date('YYYY-MM-DD')` (que es medianoche UTC y en México corre un día
 * hacia atrás), para que la mayoría de edad no dependa de la zona del servidor.
 */
const REGEX_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

function partesDeFecha(fecha) {
  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() };
  }
  const m = REGEX_FECHA.exec(String(fecha ?? ''));
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const prueba = new Date(Date.UTC(anio, mes - 1, dia));
  if (prueba.getUTCFullYear() !== anio || prueba.getUTCMonth() !== mes - 1 || prueba.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

function fechaValida(fecha) {
  return partesDeFecha(fecha) !== null;
}

function calcularEdad(fechaNacimiento, hoy = new Date()) {
  const n = partesDeFecha(fechaNacimiento);
  if (!n) return null;
  const h = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, dia: hoy.getDate() };
  let edad = h.anio - n.anio;
  if (h.mes < n.mes || (h.mes === n.mes && h.dia < n.dia)) edad -= 1;
  return edad;
}

function esMenorDeEdad(fechaNacimiento, hoy = new Date()) {
  const edad = calcularEdad(fechaNacimiento, hoy);
  return edad !== null && edad < 18;
}

module.exports = { fechaValida, calcularEdad, esMenorDeEdad, partesDeFecha };
