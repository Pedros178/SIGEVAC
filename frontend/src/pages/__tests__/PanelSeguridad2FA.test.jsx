import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelSeguridad2FA } from '../Administracion.jsx';

// Nota: PanelSeguridad2FA vivía en su propio archivo (components/administracion/
// PanelSeguridad2FA.jsx) y usaba `api` importado de compartido.jsx. Tras el
// refactor que consolidó todos los paneles de administración dentro de
// Administracion.jsx, el componente ahora se exporta como named export desde
// ahí y usa `api` de '../services/api' directamente. El comportamiento del
// componente no cambió, solo su ubicación — este test se adaptó en consecuencia.
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ usuario: { two_factor_activo: false } }),
}));

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}));
import api from '../../services/api';

describe('PanelSeguridad2FA', () => {
  beforeEach(() => vi.clearAllMocks());

  test('si el usuario no tiene 2FA activo, muestra el botón para configurarlo', () => {
    render(<PanelSeguridad2FA />);
    expect(screen.getByRole('button', { name: /configurar 2fa/i })).toBeInTheDocument();
  });

  test('al configurar, pide el QR al backend y permite activarlo con un código válido', async () => {
    api.post
      .mockResolvedValueOnce({ data: { qr: 'data:image/png;base64,xxx', secreto: 'ABCD1234' } }) // /2fa/setup
      .mockResolvedValueOnce({ data: { mensaje: '2FA activado correctamente.' } }); // /2fa/enable

    render(<PanelSeguridad2FA />);
    await userEvent.click(screen.getByRole('button', { name: /configurar 2fa/i }));

    expect(await screen.findByAltText(/código qr/i)).toBeInTheDocument();
    expect(screen.getByText(/ABCD1234/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/código de 6 dígitos/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /activar 2fa/i }));

    await waitFor(() => expect(screen.getByText('2FA activado correctamente.')).toBeInTheDocument());
    expect(api.post).toHaveBeenNthCalledWith(2, '/auth/2fa/enable', { codigo: '123456' });
  });

  test('si el backend rechaza el código, muestra el error sin tumbar el formulario', async () => {
    api.post
      .mockResolvedValueOnce({ data: { qr: 'data:image/png;base64,xxx', secreto: 'ABCD1234' } })
      .mockRejectedValueOnce({ response: { data: { error: 'Código inválido.' } } });

    render(<PanelSeguridad2FA />);
    await userEvent.click(screen.getByRole('button', { name: /configurar 2fa/i }));
    await screen.findByAltText(/código qr/i);

    await userEvent.type(screen.getByPlaceholderText(/código de 6 dígitos/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /activar 2fa/i }));

    expect(await screen.findByText('Código inválido.')).toBeInTheDocument();
  });
});
