import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../Home.jsx';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), defaults: { baseURL: 'http://localhost:4000/api' } },
}));
import api from '../../services/api';

function renderHome() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Home />
    </MemoryRouter>
  );
}

// Home pide tres endpoints públicos en paralelo (actividades, estadísticas
// y galería). Este helper deja el mock respondiendo por URL para no tener
// que repetir las tres llamadas en cada test; los tests que sí quieren
// controlar una respuesta específica (o forzar un error) la sobreescriben
// con mockImplementation antes de renderizar.
function mockearEndpointsPublicos({ actividades = [], fotos = [] } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/publico/actividades') return Promise.resolve({ data: { actividades } });
    if (url === '/publico/estadisticas') {
      return Promise.resolve({ data: { anios_trabajo: 13, voluntarios_activos: 112, estados_con_presencia: 7, areas_de_labor: 19 } });
    }
    if (url === '/publico/galeria') return Promise.resolve({ data: { fotos } });
    return Promise.resolve({ data: {} });
  });
}

describe('Home (página pública de la asociación)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('muestra el nombre, el lema y los botones de acceso al sistema y al inventario', () => {
    mockearEndpointsPublicos();
    renderHome();

    expect(screen.getAllByText('Sueños de Comedia').length).toBeGreaterThan(0);
    expect(screen.getByText(/«Participación e iniciativa juvenil/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sistema de voluntariado/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /^inventario$/i })).toHaveAttribute('href', '/inventario');
  });

  test('pide las actividades públicas al backend y las muestra sin necesitar sesión', async () => {
    mockearEndpointsPublicos({
      actividades: [{ id: 'a1', nombre: 'Jornada de reforestación', fecha: '2099-03-15', lugar: 'Bosques de San Sebastián' }],
    });
    renderHome();

    expect(api.get).toHaveBeenCalledWith('/publico/actividades');
    expect(await screen.findByText('Jornada de reforestación')).toBeInTheDocument();
    expect(screen.getByText('Bosques de San Sebastián')).toBeInTheDocument();
  });

  test('si no hay actividades próximas, muestra un mensaje en vez de una lista vacía', async () => {
    mockearEndpointsPublicos();
    renderHome();

    expect(await screen.findByText(/aún no hay actividades públicas programadas/i)).toBeInTheDocument();
  });

  test('si falla la carga de actividades, no rompe el resto de la página', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/publico/actividades') return Promise.reject(new Error('network error'));
      return Promise.resolve({ data: {} });
    });
    renderHome();

    await waitFor(() => expect(screen.getByText(/no pudimos cargar las próximas actividades/i)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /quiénes somos/i })).toBeInTheDocument();
  });

  test('los datos de contacto reales están presentes', () => {
    mockearEndpointsPublicos();
    renderHome();

    expect(screen.getByRole('link', { name: /suenoscomedia@gmail.com/i })).toHaveAttribute('href', 'mailto:suenoscomedia@gmail.com');
    expect(screen.getByRole('link', { name: /whatsapp — 247 139 7394/i })).toHaveAttribute('href', 'https://wa.me/522471397394');
  });

  test('las cifras públicas se piden al backend y se muestran cuando responde', async () => {
    mockearEndpointsPublicos();
    renderHome();

    expect(api.get).toHaveBeenCalledWith('/publico/estadisticas');
    expect(await screen.findByText('112')).toBeInTheDocument();
    expect(screen.getByText('voluntarios activos')).toBeInTheDocument();
  });

  test('si falla /publico/estadisticas, se muestran las cifras de respaldo en vez de dejar la sección vacía', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/publico/actividades') return Promise.resolve({ data: { actividades: [] } });
      if (url === '/publico/estadisticas') return Promise.reject(new Error('network error'));
      return Promise.resolve({ data: {} });
    });
    renderHome();

    await waitFor(() => expect(screen.getByText(/aún no hay actividades públicas/i)).toBeInTheDocument());
    expect(screen.getByText('112')).toBeInTheDocument();
    expect(screen.getByText('voluntarios activos')).toBeInTheDocument();
  });

  test('si el backend tiene fotos en la galería, reemplazan a las de respaldo', async () => {
    mockearEndpointsPublicos({
      fotos: [{ id: 'f1', src: '/publico/galeria/f1/imagen', alt: 'Una foto de prueba', caption: 'Foto de prueba' }],
    });
    renderHome();

    expect(api.get).toHaveBeenCalledWith('/publico/galeria');
    expect(await screen.findByText('Foto de prueba')).toBeInTheDocument();
    // La ruta relativa de la API se resuelve contra la baseURL del cliente axios.
    expect(screen.getByRole('link', { name: /ver en tamaño completo: foto de prueba/i }))
      .toHaveAttribute('href', 'http://localhost:4000/api/publico/galeria/f1/imagen');
    // Las fotos de respaldo ya no deberían mostrarse.
    expect(screen.queryByText('Danza folklórica en la plaza')).not.toBeInTheDocument();
  });

  test('si /publico/galeria falla o no devuelve fotos, se muestra la galería de respaldo', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/publico/actividades') return Promise.resolve({ data: { actividades: [] } });
      if (url === '/publico/galeria') return Promise.reject(new Error('network error'));
      return Promise.resolve({ data: {} });
    });
    renderHome();

    expect(await screen.findByText('Danza folklórica en la plaza')).toBeInTheDocument();
  });

  test('si una foto real ya no carga (archivo perdido en almacenamiento), se descarta y vuelve el respaldo', async () => {
    // Reproduce el caso real: el registro de la foto sigue en la base de
    // datos (el backend la devuelve), pero el archivo ya no existe en el
    // almacenamiento (disco efímero en Render, Supabase Storage mal
    // configurado, etc.), así que el navegador dispara onError al
    // intentar pintar el <img>. La galería no debe quedarse mostrando un
    // ícono de imagen rota: descarta esa foto y, si era la única, vuelve
    // al respaldo local.
    mockearEndpointsPublicos({
      fotos: [{ id: 'f1', src: '/publico/galeria/f1/imagen', alt: 'Una foto de prueba', caption: 'Foto de prueba' }],
    });
    renderHome();

    const imagenRota = await screen.findByAltText('Una foto de prueba');
    fireEvent.error(imagenRota);

    await waitFor(() => expect(screen.getByText('Danza folklórica en la plaza')).toBeInTheDocument());
    expect(screen.queryByText('Foto de prueba')).not.toBeInTheDocument();
  });
});
