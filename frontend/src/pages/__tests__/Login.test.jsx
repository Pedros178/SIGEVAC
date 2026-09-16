import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login.jsx';

vi.mock('../../services/api', () => ({
  guardarAccessToken: vi.fn(),
}));
import { guardarAccessToken } from '../../services/api';

function renderLogin() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Login />
    </MemoryRouter>
  );
}

function renderLoginDesde(rutaOriginal) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/login', state: { from: rutaOriginal } }]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Login />
    </MemoryRouter>
  );
}

function mockFetchOnce(status, body) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('Login', () => {
  let assignMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // window.location.assign no está implementado en jsdom (lanzaría un
    // error de "navegación no soportada") y además jsdom no permite
    // espiarlo directamente (la propiedad no es configurable), así que
    // reemplazamos el objeto `location` completo por uno simulado.
    assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock },
    });
  });

  test('con credenciales correctas, guarda el access token y redirige', async () => {
    global.fetch = mockFetchOnce(200, { access_token: 'abc123', usuario: { nombre: 'Ana' } });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@suenosdecomedia.org');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'MiClave#123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(guardarAccessToken).toHaveBeenCalledWith('abc123'));
    expect(assignMock).toHaveBeenCalledWith('/dashboard');

    // La petición de login debe incluir las credenciales del navegador
    // (cookies) para que el backend pueda fijar la cookie httpOnly del
    // refresh token — sin esto, la sesión no persistiría tras el login.
    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.credentials).toBe('include');
  });

  test('si llegó redirigido desde una ruta protegida, vuelve ahí tras el login', async () => {
    global.fetch = mockFetchOnce(200, { access_token: 'abc123', usuario: { nombre: 'Ana' } });
    renderLoginDesde('/inventario');

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@suenosdecomedia.org');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'MiClave#123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/inventario'));
  });

  test('con credenciales incorrectas, muestra el mensaje de error del backend', async () => {
    global.fetch = mockFetchOnce(401, { error: 'Credenciales inválidas.' });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@suenosdecomedia.org');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'clave-mala');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Credenciales inválidas.')).toBeInTheDocument();
    expect(guardarAccessToken).not.toHaveBeenCalled();
  });

  test('cuando el usuario tiene 2FA activo, pide el código y completa el login al validarlo', async () => {
    global.fetch = mockFetchOnce(200, { requiere_2fa: true, desafio_2fa: 'desafio-xyz' });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@suenosdecomedia.org');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'MiClave#123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByLabelText(/código de autenticación/i)).toBeInTheDocument();

    global.fetch = mockFetchOnce(200, { access_token: 'token-2fa', usuario: { nombre: 'Ana' } });
    await userEvent.type(screen.getByLabelText(/código de autenticación/i), '654321');
    await userEvent.click(screen.getByRole('button', { name: /validar código/i }));

    await waitFor(() => expect(guardarAccessToken).toHaveBeenCalledWith('token-2fa'));
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toContain('/auth/login-2fa');
    expect(JSON.parse(opciones.body)).toEqual({ desafio_2fa: 'desafio-xyz', codigo: '654321' });
  });

  test('el enlace de "olvidaste tu contraseña" cambia al modo de recuperación', async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/olvidaste tu contraseña/i));
    expect(screen.getByRole('heading', { name: /recupera tu contraseña/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^contraseña$/i)).not.toBeInTheDocument();
  });
});
