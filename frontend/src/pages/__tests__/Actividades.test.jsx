import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Actividades from '../Actividades.jsx';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
import api from '../../services/api';

vi.mock('../../components/BarraNavegacion.jsx', () => ({ default: () => <nav /> }));
vi.mock('../../components/MapaActividades.jsx', () => ({ default: () => <div /> }));
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ tienePermiso: () => true }),
}));

const ACTIVIDADES = [
  { id: 'a-1', nombre: 'Festival de otoño', fecha: '2099-03-01', lugar: 'Auditorio', estado: 'programada', total_inscritos: 5, cupo: 10 },
  { id: 'a-2', nombre: 'Taller cancelado', fecha: '2099-04-01', lugar: 'Salón B', estado: 'cancelada', total_inscritos: 0, cupo: null },
];

function renderActividades() {
  return render(<MemoryRouter><Actividades /></MemoryRouter>);
}

describe('Actividades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { actividades: ACTIVIDADES } });
  });

  test('muestra las tarjetas de indicadores calculadas a partir de la lista cargada', async () => {
    renderActividades();
    await screen.findByText(/actividades en esta vista/i);

    expect(screen.getByText('Programadas')).toBeInTheDocument();
    expect(screen.getByText('Con inscritos')).toBeInTheDocument();
    expect(screen.getByText('Canceladas')).toBeInTheDocument();
  });

  test('sin actividades cargadas no se muestran las tarjetas de indicadores', async () => {
    api.get.mockResolvedValue({ data: { actividades: [] } });
    renderActividades();

    await screen.findByText('Aún no hay actividades registradas.');
    expect(screen.queryByText(/actividades en esta vista/i)).not.toBeInTheDocument();
  });
});
