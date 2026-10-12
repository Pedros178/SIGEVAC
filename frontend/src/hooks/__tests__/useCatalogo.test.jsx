import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCatalogo, { CATALOGOS_RESPALDO } from '../useCatalogo.js';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
import api from '../../services/api';

describe('useCatalogo (opciones desde GET /api/catalogos/:tipo)', () => {
  beforeEach(() => { api.get.mockReset(); });

  test('usa las opciones que devuelve la API (fuente de verdad: la base de datos)', async () => {
    api.get.mockResolvedValue({ data: { opciones: [{ clave: 'tio', etiqueta: 'Tío/a' }] } });
    const { result } = renderHook(() => useCatalogo('parentesco'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(api.get).toHaveBeenCalledWith('/catalogos/parentesco');
    expect(result.current.opciones).toEqual([{ clave: 'tio', etiqueta: 'Tío/a' }]);
  });

  test('si la API falla, conserva las opciones de respaldo para no dejar el formulario vacío', async () => {
    api.get.mockRejectedValue(new Error('sin red'));
    const { result } = renderHook(() => useCatalogo('tipo_sangre'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.opciones).toEqual(CATALOGOS_RESPALDO.tipo_sangre);
    expect(result.current.opciones.map((o) => o.etiqueta)).toContain('AB-');
  });

  test('un catálogo que el administrador dejó vacío se respeta (no se rellena con el respaldo)', async () => {
    api.get.mockResolvedValue({ data: { opciones: [] } });
    const { result } = renderHook(() => useCatalogo('parentesco'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.opciones).toEqual([]);
  });
});
