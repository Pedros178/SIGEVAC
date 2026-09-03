import React, { useEffect, useMemo, useState } from 'react';
import geoClient from 'countrycitystatejson/client';
import api from '../services/api';

const ESTADOS_MEXICO = [
  ['Aguascalientes', 'Aguascalientes'], ['Baja California', 'Baja California'], ['Baja California Sur', 'Baja California Sur'],
  ['Campeche', 'Campeche'], ['Chiapas', 'Chiapas'], ['Chihuahua', 'Chihuahua'], ['Ciudad de México', 'Distrito Federal'],
  ['Coahuila', 'Coahuila'], ['Colima', 'Colima'], ['Durango', 'Durango'], ['Estado de México', 'Estado de Mexico'],
  ['Guanajuato', 'Guanajuato'], ['Guerrero', 'Guerrero'], ['Hidalgo', 'Hidalgo'], ['Jalisco', 'Jalisco'],
  ['Michoacán', 'Michoacan'], ['Morelos', 'Morelos'], ['Nayarit', 'Nayarit'], ['Nuevo León', 'Nuevo Leon'],
  ['Oaxaca', 'Oaxaca'], ['Puebla', 'Puebla'], ['Querétaro', 'Queretaro'], ['Quintana Roo', 'Quintana Roo'],
  ['San Luis Potosí', 'San Luis Potosi'], ['Sinaloa', 'Sinaloa'], ['Sonora', 'Sonora'], ['Tabasco', 'Tabasco'],
  ['Tamaulipas', 'Tamaulipas'], ['Tlaxcala', 'Tlaxcala'], ['Veracruz', 'Veracruz'], ['Yucatán', 'Yucatan'], ['Zacatecas', 'Zacatecas'],
];

function normalizarNombre(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function SelectorUbicacionCatalogo({ estado, municipio, onEstadoChange, onMunicipioChange, compacto = false }) {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [municipiosMexico, setMunicipiosMexico] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalogos/ubicaciones')
      .then(({ data }) => setUbicaciones(data.ubicaciones || []))
      .catch(() => setError('No se pudo cargar el catálogo de municipios. Puedes escribirlo manualmente.'));
  }, []);

  const estados = useMemo(() => ESTADOS_MEXICO.map(([nombre, nombreCatalogo]) => {
    const catalogo = ubicaciones.find((ubicacion) => normalizarNombre(ubicacion.estado) === normalizarNombre(nombreCatalogo));
    return { estado: nombre, nombreCatalogo, estado_id: catalogo?.estado_id || nombreCatalogo };
  }), [ubicaciones]);

  const estadoSeleccionado = estados.find((item) => item.estado === estado);
  const municipioSeleccionado = municipiosMexico.includes(municipio)
    ? municipio
    : ubicaciones.find((item) => item.municipio === municipio && item.estado_id === estadoSeleccionado?.estado_id)?.municipio || '';
  const municipiosCatalogo = ubicaciones
    .filter((item) => item.estado_id === estadoSeleccionado?.estado_id)
    .filter((item) => item.municipio_id)
    .map((item) => item.municipio);
  const municipios = [...new Set([...municipiosMexico, ...municipiosCatalogo])].sort((a, b) => a.localeCompare(b, 'es'));

  useEffect(() => {
    if (!estadoSeleccionado) { setMunicipiosMexico([]); return; }
    const cargarMunicipios = async () => {
      try { setMunicipiosMexico(await geoClient.getCities('MX', estadoSeleccionado.nombreCatalogo) || []); } catch { setMunicipiosMexico([]); }
    };
    cargarMunicipios();
  }, [estadoSeleccionado]);

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
      <select
        className="sg-input"
        value={municipioSeleccionado || ''}
        onChange={(e) => onMunicipioChange(e.target.value)}
        disabled={!estadoSeleccionado}
        aria-label="Municipio"
      >
        <option value="">{estadoSeleccionado ? 'Selecciona municipio' : 'Primero selecciona estado'}</option>
        {municipios.map((item) => <option key={item.municipio_id || item} value={item.municipio || item}>{item.municipio || item}</option>)}
      </select>
      {estadoSeleccionado && municipios.length === 0 && (
        <input
          className="sg-input"
          list={`municipios-${estadoSeleccionado.estado_id}`}
          value={municipio || ''}
          onChange={(e) => onMunicipioChange(e.target.value)}
          placeholder="Escribe el municipio"
          aria-label="Municipio escrito"
        />
      )}
      {estadoSeleccionado && municipios.length > 0 && <datalist id={`municipios-${estadoSeleccionado.estado_id}`}>{municipios.map((item) => <option key={item} value={item} />)}</datalist>}
      {error && <small style={{ color: 'var(--sg-danger)', width: '100%' }}>{error}</small>}
    </div>
  );
}
