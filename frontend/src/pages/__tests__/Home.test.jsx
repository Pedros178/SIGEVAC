import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../Home.jsx';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));
import api from '../../services/api';

function renderHome() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Home />
    </MemoryRouter>
  );
}

describe('Home (página pública de la asociación)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('muestra el nombre, el lema y los botones de acceso al sistema y al inventario', () => {
    api.get.mockResolvedValueOnce({ data: { actividades: [] } });
    renderHome();

    expect(screen.getAllByText('Sueños de Comedia').length).toBeGreaterThan(0);
    expect(screen.getByText(/«Participación e iniciativa juvenil/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sistema de voluntariado/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /^inventario$/i })).toHaveAttribute('href', '/inventario');
  });

  test('pide las actividades públicas al backend y las muestra sin necesitar sesión', async () => {
    api.get.mockResolvedValueOnce({
      data: { actividades: [{ id: 'a1', nombre: 'Jornada de reforestación', fecha: '2099-03-15', lugar: 'Bosques de San Sebastián' }] },
    });
    renderHome();

    expect(api.get).toHaveBeenCalledWith('/publico/actividades');
    expect(await screen.findByText('Jornada de reforestación')).toBeInTheDocument();
    expect(screen.getByText('Bosques de San Sebastián')).toBeInTheDocument();
  });

  test('si no hay actividades próximas, muestra un mensaje en vez de una lista vacía', async () => {
    api.get.mockResolvedValueOnce({ data: { actividades: [] } });
    renderHome();

    expect(await screen.findByText(/aún no hay actividades públicas programadas/i)).toBeInTheDocument();
  });

  test('si falla la carga de actividades, no rompe el resto de la página', async () => {
    api.get.mockRejectedValueOnce(new Error('network error'));
    renderHome();

    await waitFor(() => expect(screen.getByText(/no pudimos cargar las próximas actividades/i)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /quiénes somos/i })).toBeInTheDocument();
  });

  test('los datos de contacto reales están presentes', () => {
    api.get.mockResolvedValueOnce({ data: { actividades: [] } });
    renderHome();

    expect(screen.getByRole('link', { name: /suenoscomedia@gmail.com/i })).toHaveAttribute('href', 'mailto:suenoscomedia@gmail.com');
    expect(screen.getByRole('link', { name: /whatsapp — 247 139 7394/i })).toHaveAttribute('href', 'https://wa.me/522471397394');
  });
});
