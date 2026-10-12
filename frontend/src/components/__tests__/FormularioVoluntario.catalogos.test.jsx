import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FormularioVoluntario from '../FormularioVoluntario.jsx';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';

vi.mock('../EscanerDocumento.jsx', () => ({ default: () => null }));
vi.mock('../SelectorUbicacionCatalogo.jsx', () => ({ default: () => null }));

const CATALOGOS = {
  '/catalogos/tipo_sangre': [
    { clave: 'o_positivo', etiqueta: 'O+' },
    { clave: 'a_negativo', etiqueta: 'A-' },
  ],
  '/catalogos/parentesco': [
    { clave: 'madre', etiqueta: 'Madre' },
    { clave: 'tio', etiqueta: 'Tío/a' },
  ],
};

function opcionesDe(select) {
  return Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
}

describe('FormularioVoluntario alimentado por los catálogos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (CATALOGOS[url]) return Promise.resolve({ data: { opciones: CATALOGOS[url] } });
      return Promise.resolve({ data: { tipos: [], tipos_voluntario: [] } });
    });
  });

  test('el campo "Tipo de sangre" muestra las opciones que vienen de la base de datos', async () => {
    render(<FormularioVoluntario onCancelar={() => {}} />);
    const select = await screen.findByLabelText(/tipo de sangre/i).catch(() => null);
    // Campo no asocia label por id: se localiza por el texto de su etiqueta
    const etiqueta = screen.getByText('Tipo de sangre');
    const selectSangre = select || etiqueta.closest('label, div').querySelector('select');
    await waitFor(() => expect(opcionesDe(selectSangre)).toEqual(['Selecciona…', 'O+', 'A-']));
    expect(api.get).toHaveBeenCalledWith('/catalogos/tipo_sangre');
    expect(api.get).toHaveBeenCalledWith('/catalogos/parentesco');
  });

  test('al editar, un tipo de sangre guardado que ya no está en el catálogo no se pierde', async () => {
    render(<FormularioVoluntario modoEdicion voluntarioInicial={{ id: 'v1', nombre: 'Ana', fecha_nacimiento: '1990-01-01', tipo_sangre: 'Rh-nulo' }} onCancelar={() => {}} />);
    const selectSangre = screen.getByText('Tipo de sangre').closest('label, div').querySelector('select');
    await waitFor(() => expect(opcionesDe(selectSangre)).toEqual(['Selecciona…', 'Rh-nulo', 'O+', 'A-']));
    expect(selectSangre.value).toBe('Rh-nulo');
  });

  test('el parentesco del contacto de emergencia sugiere las opciones del catálogo sin restringirlas', async () => {
    const { container } = render(<FormularioVoluntario onCancelar={() => {}} />);
    await waitFor(() => {
      const lista = container.querySelector('#sg-parentescos');
      expect(Array.from(lista.querySelectorAll('option')).map((o) => o.getAttribute('value'))).toEqual(['Madre', 'Tío/a']);
    });
    const entrada = container.querySelector('input[list="sg-parentescos"]');
    expect(entrada.tagName).toBe('INPUT'); // texto libre: se puede escribir "Esposo/a", "Amiga", etc.
  });
});
