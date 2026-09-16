import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Voluntarios from '../Voluntarios.jsx';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
import api from '../../services/api';

vi.mock('../../components/BarraNavegacion.jsx', () => ({ default: () => <nav /> }));
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tienePermiso: () => true }),
}));

const VOLUNTARIOS = [
  { id: 'v-1', numero_voluntario: 'SC-2026-0001', nombre: 'Ana', apellido_paterno: 'Pérez', apellido_materno: '', es_menor_edad: false, expediente_estado: 'completo', porcentaje_avance: 100 },
  { id: 'v-2', numero_voluntario: 'SC-2026-0002', nombre: 'Luis', apellido_paterno: 'García', apellido_materno: '', es_menor_edad: true, expediente_estado: 'incompleto', porcentaje_avance: 20 },
];

function renderVoluntarios() {
  return render(<MemoryRouter><Voluntarios /></MemoryRouter>);
}

describe('Voluntarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { voluntarios: VOLUNTARIOS } });
  });

  test('muestra las tarjetas de indicadores calculadas a partir de la lista cargada', async () => {
    renderVoluntarios();
    await screen.findByText('Ana Pérez');

    expect(screen.getByText('Voluntarios en esta vista')).toBeInTheDocument();
    expect(screen.getByText('Mayores de edad')).toBeInTheDocument();
    expect(screen.getByText('Menores de edad')).toBeInTheDocument();
    expect(screen.getByText('Expedientes incompletos')).toBeInTheDocument();

    // 2 en la vista, 1 mayor, 1 menor, 1 con expediente incompleto.
    const valores = screen.getAllByText('1');
    expect(valores.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('sin voluntarios cargados no se muestran las tarjetas de indicadores', async () => {
    api.get.mockResolvedValue({ data: { voluntarios: [] } });
    renderVoluntarios();

    await screen.findByText('Aún no hay voluntarios registrados.');
    expect(screen.queryByText('Voluntarios en esta vista')).not.toBeInTheDocument();
  });
});
