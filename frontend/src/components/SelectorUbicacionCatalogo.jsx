import { useEffect, useMemo, useState } from 'react';
import municipiosPorEstado from '../data/municipiosMexico.json';
import api from '../services/api';

const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro',
  'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
  'Yucatán', 'Zacatecas',
];

function normalizarNombre(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Selector de estado + municipio. El estado se elige de una lista fija
 * (los 32 estados de México). El municipio es un combobox (input +
 * datalist): siempre se puede escribir libremente o elegir una de las
 * sugerencias, que combinan el catálogo local (INEGI, los 32 estados
 * completos) con lo que ya exista en la base de datos del sistema.
 */
export default function SelectorUbicacionCatalogo({ estado, municipio, onEstadoChange, onMunicipioChange, compacto = false }) {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalogos/ubicaciones')
      .then(({ data }) => setUbicaciones(data.ubicaciones || []))
      .catch(() => setError('No se pudo cargar el catálogo adicional de municipios. Puedes escribirlo manualmente.'));
  }, []);

  const estados = useMemo(() => ESTADOS_MEXICO.map((nombre) => {
    const catalogo = ubicaciones.find((ubicacion) => normalizarNombre(ubicacion.estado) === normalizarNombre(nombre));
    return { estado: nombre, estado_id: catalogo?.estado_id || nombre };
  }), [ubicaciones]);

  const estadoSeleccionado = estados.find((item) => item.estado === estado);

  const municipiosINEGI = estadoSeleccionado ? (municipiosPorEstado[estadoSeleccionado.estado] || []) : [];
  const municipiosCatalogo = ubicaciones
    .filter((item) => item.estado_id === estadoSeleccionado?.estado_id)
    .filter((item) => item.municipio_id)
    .map((item) => item.municipio);
  const municipios = [...new Set([...municipiosINEGI, ...municipiosCatalogo])].sort((a, b) => a.localeCompare(b, 'es'));

  const idDatalist = `municipios-${normalizarNombre(estadoSeleccionado?.estado || 'sin-estado')}`;

  return (
    <div style={{ display: 'flex', flexDirection: compacto ? 'row' : 'column', gap: 10, flex: 1, flexWrap: 'wrap' }}>
      <select
        className="sg-input"
        value={estadoSeleccionado?.estado_id || ''}
        onChange={(e) => { const item = estados.find((opcion) => String(opcion.estado_id) === e.target.value); onEstadoChange(item?.estado || ''); onMunicipioChange(''); }}
        aria-label="Estado"
      >
        <option value="">Selecciona estado</option>
        {estados.map((item) => <option key={item.estado_id} value={item.estado_id}>{item.estado}</option>)}
      </select>

      <input
        className="sg-input"
        list={idDatalist}
        value={municipio || ''}
        onChange={(e) => onMunicipioChange(e.target.value)}
        disabled={!estadoSeleccionado}
        placeholder={estadoSeleccionado ? 'Escribe o elige el municipio' : 'Primero selecciona estado'}
        aria-label="Municipio"
        autoComplete="off"
      />
      <datalist id={idDatalist}>
        {municipios.map((item) => <option key={item} value={item} />)}
      </datalist>

      {error && <small style={{ color: 'var(--sg-danger)', width: '100%' }}>{error}</small>}
    </div>
  );
}
