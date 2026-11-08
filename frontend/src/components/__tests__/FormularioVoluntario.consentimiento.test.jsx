import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormularioVoluntario from '../FormularioVoluntario.jsx';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';

vi.mock('../EscanerDocumento.jsx', () => ({ default: () => null }));
vi.mock('../SelectorUbicacionCatalogo.jsx', () => ({ default: () => null }));

const enEdicion = (extra = {}) => ({ id: 'v1', nombre: 'Ana', fecha_nacimiento: '1990-01-01', fecha_ingreso: '2026-01-01', ...extra });
const BLOQUE = { name: /consentimiento para datos de salud/i }; // el bloque se expone como grupo accesible

describe('FormularioVoluntario — consentimiento para datos de salud (art. 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { opciones: [], tipos: [] } });
    api.put.mockResolvedValue({ data: { voluntario: { id: 'v1' } } });
    api.post.mockResolvedValue({ data: { voluntario: { id: 'v2' } } });
  });

  test('sin datos de salud no aparece el bloque de consentimiento', () => {
    render(<FormularioVoluntario modoEdicion voluntarioInicial={enEdicion()} onActualizado={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('group', BLOQUE)).toBeNull();
  });

  test('"Ninguna" no cuenta como dato de salud', () => {
    render(<FormularioVoluntario modoEdicion voluntarioInicial={enEdicion({ discapacidad: 'Ninguna', enfermedad_cronica: 'N/A' })} onActualizado={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('group', BLOQUE)).toBeNull();
  });

  test('al capturar un dato de salud aparece el bloque y NO se envía sin confirmar el consentimiento', async () => {
    const user = userEvent.setup();
    const onActualizado = vi.fn();
    render(<FormularioVoluntario modoEdicion voluntarioInicial={enEdicion()} onActualizado={onActualizado} onCancelar={() => {}} />);
    await user.type(screen.getAllByPlaceholderText('Ninguna o especificar')[1], 'Asma'); // [0] discapacidad, [1] enfermedad crónica
    expect(await screen.findByRole('group', BLOQUE)).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('button', { name: /guardar|actualizar|registrar/i }).closest('form'));
    expect(await screen.findByText(/confirma que se obtuvo el consentimiento/i)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('con la casilla marcada se envía consentimientoDatosSensibles: true', async () => {
    const user = userEvent.setup();
    render(<FormularioVoluntario modoEdicion voluntarioInicial={enEdicion()} onActualizado={() => {}} onCancelar={() => {}} />);
    await user.type(screen.getAllByPlaceholderText('Ninguna o especificar')[1], 'Asma');
    await user.click(await screen.findByRole('checkbox', { name: /otorgó su consentimiento expreso/i }));
    fireEvent.submit(screen.getByRole('button', { name: /guardar|actualizar|registrar/i }).closest('form'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.put.mock.calls[0][1]).toMatchObject({ enfermedadCronica: 'Asma', consentimientoDatosSensibles: true });
  });

  test('si ya hay un consentimiento vigente no se vuelve a pedir y no se envía la bandera', async () => {
    render(<FormularioVoluntario modoEdicion voluntarioInicial={enEdicion({ enfermedad_cronica: 'Asma', consentimiento_datos_sensibles: true })} onActualizado={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText(/consentimiento vigente registrado/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /otorgó su consentimiento/i })).toBeNull();
    fireEvent.submit(screen.getByRole('button', { name: /guardar|actualizar|registrar/i }).closest('form'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('consentimientoDatosSensibles');
  });
});
