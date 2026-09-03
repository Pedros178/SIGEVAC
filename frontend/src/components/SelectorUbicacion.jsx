import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRO_PUEBLA } from './MapaActividades.jsx';

/**
 * Selector de ubicación para el formulario de actividades: un mapa
 * clicable (el clic mueve el marcador y actualiza latitud/longitud),
 * más un botón para usar la ubicación actual del navegador. Los campos
 * de latitud/longitud son opcionales en el formulario, así que este
 * selector también lo es — nunca bloquea el guardado si no se usa.
 */
export default function SelectorUbicacion({ latitud, longitud, onCambiar }) {
  const [errorGeo, setErrorGeo] = useState('');
  const [buscandoGeo, setBuscandoGeo] = useState(false);
  const posicion = latitud && longitud ? [Number(latitud), Number(longitud)] : null;

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setErrorGeo('Tu navegador no soporta geolocalización.');
      return;
    }
    setBuscandoGeo(true);
    setErrorGeo('');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        onCambiar(posicion.coords.latitude.toFixed(7), posicion.coords.longitude.toFixed(7));
        setBuscandoGeo(false);
      },
      () => {
        setErrorGeo('No se pudo obtener tu ubicación. Puedes marcarla en el mapa manualmente.');
        setBuscandoGeo(false);
      }
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>
          {posicion ? 'Ubicación marcada — haz clic de nuevo para moverla.' : 'Haz clic en el mapa para marcar el lugar (opcional).'}
        </span>
        <button type="button" onClick={usarMiUbicacion} disabled={buscandoGeo} style={styles.botonUbicacion}>
          {buscandoGeo ? 'Buscando…' : '📍 Usar mi ubicación'}
        </button>
      </div>

      <div style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sg-border)' }}>
        <MapContainer center={posicion || CENTRO_PUEBLA} zoom={posicion ? 15 : 11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CapturadorClic onClic={(lat, lng) => onCambiar(lat.toFixed(7), lng.toFixed(7))} />
          {posicion && <Marker position={posicion} />}
        </MapContainer>
      </div>

      {errorGeo && <p style={{ fontSize: 12, color: 'var(--sg-danger)', marginTop: 6 }}>{errorGeo}</p>}

      {posicion && (
        <button type="button" onClick={() => onCambiar('', '')} style={styles.botonQuitar}>
          Quitar ubicación
        </button>
      )}
    </div>
  );
}

function CapturadorClic({ onClic }) {
  useMapEvents({
    click(evento) {
      onClic(evento.latlng.lat, evento.latlng.lng);
    },
  });
  return null;
}

const styles = {
  botonUbicacion: {
    fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', background: 'transparent', cursor: 'pointer',
  },
  botonQuitar: {
    fontSize: 12, color: 'var(--sg-danger)', background: 'transparent', border: 'none',
    cursor: 'pointer', marginTop: 8, padding: 0, textDecoration: 'underline',
  },
};
