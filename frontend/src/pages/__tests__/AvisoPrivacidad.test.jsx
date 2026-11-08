import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AvisoPrivacidad from '../AvisoPrivacidad.jsx';
import AvisoSimplificado from '../../components/AvisoSimplificado.jsx';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
import api from '../../services/api';

const COMPLETO = {
  responsable: 'Asociación Ejemplo, A.C.', domicilio: 'Calle 1, Tehuacán, Puebla', correo_arco: 'arco@ejemplo.org',
  persona_designada: 'María Pérez', version_aviso: '2026-2', completo: true,
};

function montar(aviso, ruta = '/aviso-privacidad?asociacion=a1') {
  api.get.mockImplementation((url) => {
    if (url === '/publico/aviso-privacidad') return Promise.resolve({ data: { aviso } });
    return Promise.resolve({ data: { asociaciones: [] } });
  });
  return render(<MemoryRouter initialEntries={[ruta]}><AvisoPrivacidad /></MemoryRouter>);
}

describe('Aviso de privacidad integral (art. 15)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('contiene los elementos que exige la ley y los datos configurados por la asociación', async () => {
    montar(COMPLETO);
    expect(await screen.findByRole('heading', { name: /aviso de privacidad integral/i })).toBeInTheDocument();
    expect(screen.getByText(/Asociación Ejemplo, A\.C\./)).toBeInTheDocument();
    expect(screen.getByText(/María Pérez/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'arco@ejemplo.org' }).length).toBeGreaterThan(0);
    for (const titulo of [/responsable/i, /datos personales que tratamos/i, /finalidades/i, /limitar el uso/i, /derechos arco/i, /transferencias/i, /cambios a este aviso/i]) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    }
    expect(screen.getByText(/datos personales sensibles/i)).toBeInTheDocument();
    expect(screen.getByText(/20 días hábiles/)).toBeInTheDocument();
    expect(screen.getByText(/Secretaría Anticorrupción/)).toBeInTheDocument();
    expect(screen.queryByText(/aviso incompleto/i)).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/publico/aviso-privacidad', { params: { asociacion_id: 'a1' } });
  });

  test('si la asociación no ha capturado domicilio/correo/persona, el aviso se marca como incompleto', async () => {
    montar({ responsable: 'Asociación Ejemplo, A.C.', version_aviso: '2026-1', completo: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/aviso incompleto/i);
    expect(screen.getAllByText(/pendiente de (capturar|designar)/i, { selector: 'em' }).length).toBeGreaterThanOrEqual(2); // domicilio, persona y/o correo
  });
});

describe('Aviso de privacidad simplificado (art. 16, fr. II)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('muestra responsable, datos, finalidades, opciones para limitar y enlace al integral', async () => {
    api.get.mockResolvedValue({ data: { aviso: COMPLETO } });
    render(<MemoryRouter><AvisoSimplificado asociacionId="a1" /></MemoryRouter>);
    expect(await screen.findByText(/Asociación Ejemplo, A\.C\./)).toBeInTheDocument();
    expect(screen.getByText(/No pedimos datos sensibles/i)).toBeInTheDocument();
    expect(screen.getByText(/necesarias/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'arco@ejemplo.org' })).toHaveAttribute('href', 'mailto:arco@ejemplo.org');
    expect(screen.getByRole('link', { name: /aviso de privacidad integral/i })).toHaveAttribute('href', '/aviso-privacidad?asociacion=a1');
  });

  test('sin asociación seleccionada no muestra nada', () => {
    const { container } = render(<MemoryRouter><AvisoSimplificado asociacionId="" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
