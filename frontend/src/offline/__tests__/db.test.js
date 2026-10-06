import { describe, test, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  encolarAccion,
  listarAccionesPendientes,
  contarAccionesPendientes,
  eliminarAccion,
  incrementarIntentos,
  guardarActividadEnCache,
  obtenerActividadDeCache,
} from '../db';

// Una IndexedDB nueva y vacía en cada prueba, para que no arrastren estado
// entre sí (cada una empieza desde cero, como si fuera un dispositivo recién
// instalado).
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('offline/db — cola de acciones pendientes', () => {
  test('encolar una acción y luego listarla devuelve exactamente esa acción', async () => {
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const pendientes = await listarAccionesPendientes();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatchObject({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', intentos: 0 });
  });

  test('contarAccionesPendientes refleja el número real de acciones en cola', async () => {
    expect(await contarAccionesPendientes()).toBe(0);
    await encolarAccion({ actividadId: 'a', participacionId: 'p1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });
    await encolarAccion({ actividadId: 'a', participacionId: 'p2', tipo: 'entrada', horaCliente: '2026-08-20T10:05:00.000Z' });
    expect(await contarAccionesPendientes()).toBe(2);
  });

  test('eliminarAccion la retira de la cola (así se usa tras sincronizar con éxito)', async () => {
    const id = await encolarAccion({ actividadId: 'a', participacionId: 'p1', tipo: 'salida', horaCliente: '2026-08-20T12:00:00.000Z' });
    expect(await contarAccionesPendientes()).toBe(1);

    await eliminarAccion(id);
    expect(await contarAccionesPendientes()).toBe(0);
  });

  test('incrementarIntentos aumenta el contador de intentos de una acción específica', async () => {
    const id = await encolarAccion({ actividadId: 'a', participacionId: 'p1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });
    await incrementarIntentos(id);
    await incrementarIntentos(id);

    const [accion] = await listarAccionesPendientes();
    expect(accion.intentos).toBe(2);
    expect(accion.ultimoIntentoEn).toBeTruthy();
  });

  test('las acciones de distintas actividades conviven sin mezclarse', async () => {
    await encolarAccion({ actividadId: 'act-1', participacionId: 'p1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });
    await encolarAccion({ actividadId: 'act-2', participacionId: 'p2', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const todas = await listarAccionesPendientes();
    expect(todas.map((a) => a.actividadId).sort()).toEqual(['act-1', 'act-2']);
  });
});

describe('offline/db — caché de actividades para consulta sin conexión', () => {
  test('guardar y luego obtener una actividad de la caché devuelve los mismos datos', async () => {
    const datos = { id: 'act-1', nombre: 'Jornada de prueba', participantes: [] };
    await guardarActividadEnCache('act-1', datos);

    const enCache = await obtenerActividadDeCache('act-1');
    expect(enCache.datos).toEqual(datos);
    expect(enCache.guardadoEn).toBeTruthy();
  });

  test('guardar la misma actividad dos veces sobrescribe la copia anterior (no duplica)', async () => {
    await guardarActividadEnCache('act-1', { nombre: 'Versión vieja' });
    await guardarActividadEnCache('act-1', { nombre: 'Versión nueva' });

    const enCache = await obtenerActividadDeCache('act-1');
    expect(enCache.datos.nombre).toBe('Versión nueva');
  });

  test('pedir una actividad que nunca se guardó devuelve null', async () => {
    const enCache = await obtenerActividadDeCache('no-existe');
    expect(enCache).toBeNull();
  });
});

describe('aviso de cambio en la cola offline', () => {
  test('encolarAccion emite sigevac:cola-cambio para que la barra de estado actualice el contador', async () => {
    let avisos = 0;
    const escucha = () => { avisos += 1; };
    window.addEventListener('sigevac:cola-cambio', escucha);
    await encolarAccion({ actividadId: 'a', participacionId: 'p-aviso', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });
    window.removeEventListener('sigevac:cola-cambio', escucha);
    expect(avisos).toBe(1);
  });
});
