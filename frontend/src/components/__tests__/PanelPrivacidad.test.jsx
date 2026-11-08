import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PanelPrivacidad from '../PanelPrivacidad.jsx';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
import api from '../../services/api';

const SOLICITUD = {
  id: 's1', tipo: 'acceso', estado: 'recibida', voluntario_id: 'v1', voluntario_nombre: 'Ana Pérez', ampliada: false,
  fecha_limite: '2026-12-01T00:00:00.000Z', fecha_limite_ejecucion: null, vencida: true,
};

describe('PanelPrivacidad (Administración)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/privacidad/aviso') return Promise.resolve({ data: { aviso: { correo_arco: 'arco@ejemplo.org' } } });
      if (url === '/privacidad/arco') return Promise.resolve({ data: { solicitudes: [SOLICITUD] } });
      if (url === '/privacidad/retencion/candidatos') return Promise.resolve({ data: { candidatos: [{ id: 'v9', numero_voluntario: 'V-9', nombre: 'Luis Antiguo', fecha_baja: '2015-01-01' }] } });
      return Promise.resolve({ data: {} });
    });
    api.put.mockResolvedValue({ data: {} });
    api.patch.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
  });

  test('guarda los datos del aviso sin enviar los campos vacíos', async () => {
    const user = userEvent.setup();
    render(<PanelPrivacidad />);
    const domicilio = await screen.findByLabelText(/domicilio del responsable/i);
    await user.type(domicilio, 'Calle 1, Tehuacán');
    await user.click(screen.getByRole('button', { name: /guardar aviso/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/privacidad/aviso', { correo_arco: 'arco@ejemplo.org', domicilio: 'Calle 1, Tehuacán' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/aviso guardado/i);
  });

  test('lista las solicitudes ARCO con su plazo y la alerta de vencida', async () => {
    render(<PanelPrivacidad />);
    const fila = (await screen.findByText('Ana Pérez')).closest('tr');
    expect(within(fila).getByText(/vencida/i)).toBeInTheDocument();
    expect(within(fila).getByText('2026-12-01')).toBeInTheDocument();
  });

  test('se puede ampliar el plazo y descargar los datos de la persona', async () => {
    const user = userEvent.setup();
    render(<PanelPrivacidad />);
    const fila = (await screen.findByText('Ana Pérez')).closest('tr');
    await user.click(within(fila).getByRole('button', { name: /ampliar plazo/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/privacidad/arco/s1/ampliar'));
    expect(within(fila).getByRole('button', { name: /descargar datos/i })).toBeInTheDocument();
  });

  test('eliminar datos de una baja antigua exige motivo y confirmación explícita', async () => {
    const user = userEvent.setup();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Depuración periódica');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PanelPrivacidad />);
    await user.click(await screen.findByRole('button', { name: /buscar/i }));
    const boton = await screen.findByRole('button', { name: /eliminar datos personales/i });

    await user.click(boton); // el usuario se arrepiente en la confirmación
    expect(api.post).not.toHaveBeenCalled();

    await user.click(boton);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/privacidad/voluntarios/v9/anonimizar', { confirmar: true, motivo: 'Depuración periódica' }));
    prompt.mockRestore(); confirmar.mockRestore();
  });
});
