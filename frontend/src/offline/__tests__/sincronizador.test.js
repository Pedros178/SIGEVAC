import { describe, test, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { encolarAccion, listarAccionesPendientes } from '../db';
import { sincronizarPendientes } from '../sincronizador';

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}));
import api from '../../services/api';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  api.post.mockReset();
});

describe('offline/sincronizador', () => {
  test('una acción de entrada sincronizada con éxito se envía al endpoint correcto y se retira de la cola', async () => {
    api.post.mockResolvedValue({ data: { asistencia: {} } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const resultado = await sincronizarPendientes();

    expect(api.post).toHaveBeenCalledWith('/participaciones/part-1/entrada', { horaCliente: '2026-08-20T10:00:00.000Z' });
    expect(resultado).toEqual({ sincronizadas: 1, fallidas: 0, pendientes: 0 });
    expect(await listarAccionesPendientes()).toHaveLength(0);
  });

  test('una acción de salida incluye observaciones cuando existen', async () => {
    api.post.mockResolvedValue({ data: { asistencia: {} } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'salida', horaCliente: '2026-08-20T13:00:00.000Z', observaciones: 'Salió temprano' });

    await sincronizarPendientes();

    expect(api.post).toHaveBeenCalledWith('/participaciones/part-1/salida', { horaCliente: '2026-08-20T13:00:00.000Z', observaciones: 'Salió temprano' });
  });

  test('las acciones se sincronizan en el orden en que se capturaron', async () => {
    api.post.mockResolvedValue({ data: { asistencia: {} } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z', creadoEnManual: 1 });
    // Se fuerza un pequeño desfase real entre inserciones para que el orden de creadoEn sea determinista.
    await new Promise((r) => setTimeout(r, 5));
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'salida', horaCliente: '2026-08-20T13:00:00.000Z' });

    await sincronizarPendientes();

    expect(api.post.mock.calls[0][0]).toBe('/participaciones/part-1/entrada');
    expect(api.post.mock.calls[1][0]).toBe('/participaciones/part-1/salida');
  });

  test('un conflicto 409 (ya se había registrado) se descarta sin contarse como fallo', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { error: 'ya registrado' } } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const resultado = await sincronizarPendientes();

    expect(resultado).toEqual({ sincronizadas: 0, fallidas: 0, pendientes: 0 });
    expect(await listarAccionesPendientes()).toHaveLength(0);
  });

  test('un 404 (participación ya no existe) también se descarta sin contarse como fallo', async () => {
    api.post.mockRejectedValue({ response: { status: 404 } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const resultado = await sincronizarPendientes();
    expect(resultado.pendientes).toBe(0);
  });

  test('un error de validación (400) se descarta tras el primer intento, no se reintenta indefinidamente', async () => {
    api.post.mockRejectedValue({ response: { status: 400, data: { error: 'horaCliente inválida' } } });
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: 'fecha-invalida' });

    const resultado = await sincronizarPendientes();

    expect(resultado).toEqual({ sincronizadas: 0, fallidas: 1, pendientes: 0 });
    expect(await listarAccionesPendientes()).toHaveLength(0);
  });

  test('un error de red (sin response) conserva la acción en la cola para reintentar después', async () => {
    api.post.mockRejectedValue(new Error('Network Error')); // sin .response, como un fallo real de conectividad
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });

    const resultado = await sincronizarPendientes();

    expect(resultado).toEqual({ sincronizadas: 0, fallidas: 1, pendientes: 1 });
    const pendientes = await listarAccionesPendientes();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].intentos).toBe(1);
  });

  test('con la cola vacía, sincronizar no hace ninguna llamada y no falla', async () => {
    const resultado = await sincronizarPendientes();
    expect(api.post).not.toHaveBeenCalled();
    expect(resultado).toEqual({ sincronizadas: 0, fallidas: 0, pendientes: 0 });
  });

  test('varias acciones mixtas: algunas sincronizan y otras quedan pendientes por error de red', async () => {
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-1', tipo: 'entrada', horaCliente: '2026-08-20T10:00:00.000Z' });
    await new Promise((r) => setTimeout(r, 5));
    await encolarAccion({ actividadId: 'act-1', participacionId: 'part-2', tipo: 'entrada', horaCliente: '2026-08-20T10:05:00.000Z' });

    api.post
      .mockResolvedValueOnce({ data: {} }) // part-1: éxito
      .mockRejectedValueOnce(new Error('Network Error')); // part-2: sigue sin red

    const resultado = await sincronizarPendientes();

    expect(resultado.sincronizadas).toBe(1);
    expect(resultado.pendientes).toBe(1);
    const restante = await listarAccionesPendientes();
    expect(restante[0].participacionId).toBe('part-2');
  });
});
