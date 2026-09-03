import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Inventario from '../Inventario.jsx';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import api from '../../services/api';

vi.mock('../../components/BarraNavegacion.jsx', () => ({ default: () => <nav /> }));

let puedeGestionar = true;
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tieneAlgunPermiso: () => puedeGestionar }),
}));

const ARTICULO_PRESTABLE = {
  id: 'art-1', nombre: 'Vestido de danza folklórica', categoria_id: 'cat-1', categoria_nombre: 'Vestuario',
  subcategoria_id: null, subcategoria_nombre: null, unidad: 'pieza', existencias: 3, minimo: 0,
  estado_fisico: 'bueno', es_prestable: true, foto_principal_id: null,
};
const ARTICULO_CONSUMIBLE = {
  id: 'art-2', nombre: 'Resma de papel', categoria_id: null, categoria_nombre: null,
  subcategoria_id: null, subcategoria_nombre: null, unidad: 'pieza', existencias: 10, minimo: 2,
  estado_fisico: 'bueno', es_prestable: false, foto_principal_id: null,
};
const CATEGORIAS = [{ id: 'cat-1', nombre: 'Vestuario', subcategorias: [] }];
const PRESTAMOS = [{
  id: 'p-1', articulo_id: 'art-1', articulo_nombre: 'Vestido de danza folklórica', unidad: 'pieza',
  responsable: 'Ana Voluntaria', motivo: null, cantidad: 1, estado: 'prestado', atrasado: false,
  fecha_devolucion_programada: '2099-01-15',
}];

function mockCargaInicial() {
  api.get.mockImplementation((url) => {
    if (url === '/inventario/categorias') return Promise.resolve({ data: { categorias: CATEGORIAS } });
    if (url === '/inventario') return Promise.resolve({ data: { articulos: [ARTICULO_PRESTABLE, ARTICULO_CONSUMIBLE] } });
    if (url === '/inventario/prestamos') return Promise.resolve({ data: { prestamos: PRESTAMOS } });
    return Promise.resolve({ data: {} });
  });
}

describe('Inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    puedeGestionar = true;
    mockCargaInicial();
  });

  test('muestra los artículos con la insignia "Prestable" solo cuando corresponde', async () => {
    render(<Inventario />);
    expect(await screen.findByText('Vestido de danza folklórica')).toBeInTheDocument();
    expect(screen.getByText('Resma de papel')).toBeInTheDocument();
    expect(screen.getByText('Prestable')).toBeInTheDocument(); // solo el artículo prestable la muestra
  });

  test('crear un artículo marcado como prestable envía es_prestable: true al backend', async () => {
    api.post.mockResolvedValueOnce({ data: { articulo: { ...ARTICULO_PRESTABLE, id: 'nuevo' } } });
    render(<Inventario />);

    await userEvent.click(await screen.findByRole('button', { name: /nuevo artículo/i }));
    await userEvent.type(screen.getByPlaceholderText(/nombre del artículo/i), 'Sombrero de charro');
    await userEvent.click(screen.getByLabelText(/se puede prestar/i));
    await userEvent.click(screen.getByRole('button', { name: /agregar artículo/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/inventario', expect.objectContaining({
      nombre: 'Sombrero de charro', es_prestable: true,
    })));
  });

  test('el selector de préstamos solo ofrece artículos marcados como prestables', async () => {
    render(<Inventario />);
    await screen.findByText('Vestido de danza folklórica');

    await userEvent.click(screen.getByRole('button', { name: /préstamos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /nuevo préstamo/i }));

    expect(screen.getByRole('option', { name: /vestido de danza folklórica/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /resma de papel/i })).not.toBeInTheDocument();
  });

  test('registrar un préstamo llama a la API con los datos del formulario', async () => {
    api.post.mockResolvedValueOnce({ data: { prestamo: { id: 'nuevo' } } });
    render(<Inventario />);
    await screen.findByText('Vestido de danza folklórica');

    await userEvent.click(screen.getByRole('button', { name: /préstamos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /nuevo préstamo/i }));

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 'art-1');
    await userEvent.type(screen.getByPlaceholderText(/responsable/i), 'Comité de danza');
    await userEvent.type(screen.getByPlaceholderText(/^condición de entrega$/i), 'Buen estado');
    const fechaInput = document.querySelector('input[type="date"]');
    await userEvent.type(fechaInput, '2099-02-01');
    await userEvent.click(screen.getByRole('button', { name: /registrar préstamo/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/inventario/prestamos', expect.objectContaining({
      articulo_id: 'art-1', responsable: 'Comité de danza', fecha_devolucion_programada: '2099-02-01',
    })));
  });

  test('devolver un préstamo llama al endpoint correcto con la condición capturada', async () => {
    api.put.mockResolvedValueOnce({ data: { prestamo: { id: 'p-1', estado: 'devuelto' } } });
    render(<Inventario />);

    await userEvent.click(screen.getByRole('button', { name: /préstamos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^devolver$/i }));

    // No se captura condición: el endpoint debe llamarse igual, con cadena vacía.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/inventario/prestamos/p-1/devolver', { condicion_retorno: '' }));
  });

  test('sin permiso de gestionar, no se muestran los botones de crear ni de nuevo préstamo', async () => {
    puedeGestionar = false;
    render(<Inventario />);

    await screen.findByText('Vestido de danza folklórica');
    expect(screen.queryByRole('button', { name: /nuevo artículo/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /préstamos/i }));
    expect(screen.queryByRole('button', { name: /nuevo préstamo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^devolver$/i })).not.toBeInTheDocument();
  });
});
