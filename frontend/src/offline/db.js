import { openDB } from 'idb';

const NOMBRE_BD = 'sigevac-offline';
const VERSION_BD = 1;

/**
 * Dos "almacenes" (object stores):
 *
 * - cola_acciones: acciones de asistencia (entrada/salida) capturadas sin
 *   conexión, pendientes de enviar al servidor. Cada una guarda la hora
 *   REAL del dispositivo en el momento del evento (no la de sincronización),
 *   que es justo lo que el backend espera en `horaCliente`.
 *
 * - cache_actividades: última copia conocida de cada actividad (con su
 *   lista de participantes), para poder seguir viendo y operando la
 *   pantalla de una actividad aunque no haya red en ese momento.
 */
function getDB() {
  return openDB(NOMBRE_BD, VERSION_BD, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cola_acciones')) {
        const store = db.createObjectStore('cola_acciones', { keyPath: 'id', autoIncrement: true });
        store.createIndex('por_actividad', 'actividadId');
      }
      if (!db.objectStoreNames.contains('cache_actividades')) {
        db.createObjectStore('cache_actividades', { keyPath: 'actividadId' });
      }
    },
  });
}

/**
 * Encola una acción de entrada o salida capturada sin conexión.
 * @param {{ actividadId: string, participacionId: string, tipo: 'entrada'|'salida', horaCliente: string, observaciones?: string }} accion
 */
export async function encolarAccion(accion) {
  const db = await getDB();
  const id = await db.add('cola_acciones', { ...accion, creadoEn: new Date().toISOString(), intentos: 0 });
  return id;
}

export async function listarAccionesPendientes() {
  const db = await getDB();
  return db.getAll('cola_acciones');
}

export async function contarAccionesPendientes() {
  const db = await getDB();
  return db.count('cola_acciones');
}

export async function eliminarAccion(id) {
  const db = await getDB();
  return db.delete('cola_acciones', id);
}

export async function incrementarIntentos(id) {
  const db = await getDB();
  const accion = await db.get('cola_acciones', id);
  if (!accion) return;
  accion.intentos += 1;
  accion.ultimoIntentoEn = new Date().toISOString();
  await db.put('cola_acciones', accion);
}

/** Guarda la última copia conocida de una actividad (para verla offline). */
export async function guardarActividadEnCache(actividadId, datos) {
  const db = await getDB();
  return db.put('cache_actividades', { actividadId, datos, guardadoEn: new Date().toISOString() });
}

export async function obtenerActividadDeCache(actividadId) {
  const db = await getDB();
  const registro = await db.get('cache_actividades', actividadId);
  return registro || null;
}
