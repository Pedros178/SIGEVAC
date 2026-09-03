import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext.jsx';

// Mockeamos la capa de red por completo: estas pruebas verifican el
// contrato de AuthContext (qué hace con las respuestas), no axios real.
vi.mock('../../services/api.js', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  guardarAccessToken: vi.fn(),
  limpiarAccessToken: vi.fn(),
}));

import api, { guardarAccessToken, limpiarAccessToken } from '../../services/api.js';

function Consumidor() {
  const { usuario, cargando, login, logout, tienePermiso, tieneRol } = useAuth();
  return (
    <div>
      <span data-testid="cargando">{String(cargando)}</span>
      <span data-testid="usuario">{usuario ? usuario.nombre : 'sin-sesion'}</span>
      <span data-testid="permiso-x">{String(tienePermiso('usuarios.editar'))}</span>
      <span data-testid="rol-admin">{String(tieneRol('super_admin'))}</span>
      <button onClick={() => login('a@b.com', 'clave123')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('al montar, intenta un refresh silencioso; si no hay sesión, queda sin usuario', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } });

    render(<AuthProvider><Consumidor /></AuthProvider>);

    expect(screen.getByTestId('cargando').textContent).toBe('true');

    await waitFor(() => expect(screen.getByTestId('cargando').textContent).toBe('false'));
    expect(screen.getByTestId('usuario').textContent).toBe('sin-sesion');
    expect(limpiarAccessToken).toHaveBeenCalled();
  });

  test('al montar, si la cookie httpOnly sigue vigente, restaura la sesión sin pedir credenciales', async () => {
    api.post.mockResolvedValueOnce({ data: { access_token: 'nuevo-token' } });
    api.get.mockResolvedValueOnce({
      data: { usuario: { nombre: 'Ana', permisos: [], roles: [] } },
    });

    render(<AuthProvider><Consumidor /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('usuario').textContent).toBe('Ana'));
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', {});
    expect(guardarAccessToken).toHaveBeenCalledWith('nuevo-token');
  });

  test('login guarda el access token y actualiza el usuario', async () => {
    // Refresh silencioso inicial: sin sesión.
    api.post.mockRejectedValueOnce({ response: { status: 401 } });
    render(<AuthProvider><Consumidor /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('cargando').textContent).toBe('false'));

    api.post.mockResolvedValueOnce({
      data: { access_token: 'token-login', usuario: { nombre: 'Beto', permisos: ['usuarios.editar'], roles: [{ nombre: 'super_admin' }] } },
    });

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('usuario').textContent).toBe('Beto'));
    expect(guardarAccessToken).toHaveBeenCalledWith('token-login');
    expect(screen.getByTestId('permiso-x').textContent).toBe('true');
    expect(screen.getByTestId('rol-admin').textContent).toBe('true');
  });

  test('logout limpia el access token y el usuario, incluso si la petición al backend falla', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } }); // refresh inicial
    render(<AuthProvider><Consumidor /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('cargando').textContent).toBe('false'));

    api.post.mockResolvedValueOnce({
      data: { access_token: 't', usuario: { nombre: 'Carla', permisos: [], roles: [] } },
    });
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('usuario').textContent).toBe('Carla'));

    api.post.mockRejectedValueOnce(new Error('red caída'));
    await userEvent.click(screen.getByText('logout'));

    expect(screen.getByTestId('usuario').textContent).toBe('sin-sesion');
    expect(limpiarAccessToken).toHaveBeenCalled();
  });
});
