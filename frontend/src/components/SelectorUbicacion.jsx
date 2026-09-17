import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRO_PUEBLA } from './MapaActividades.jsx';
import api from '../services/api';

/**
 * Selector de ubicación para el formulario de actividades: permite
 * buscar un lugar por nombre/dirección (geocodificación con Nominatim/
 * OpenStreetMap, sin API key) y elegirlo de una lista de sugerencias,
 * marcar directamente con un clic en el mapa, o usar la ubicación
 * actual del navegador. Los campos de latitud/longitud son opcionales
 * en el formulario, así que este selector también lo es — nunca
 * bloquea el guardado si no se usa.
 */
export default function SelectorUbicacion({ latitud, longitud, onCambiar, onLugarSugerido }) {
  const [errorGeo, setErrorGeo] = useState('');
  const [buscandoGeo, setBuscandoGeo] = useState(false);
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscandoTexto, setBuscandoTexto] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const idPeticion = useRef(0);
  const posicion = latitud && longitud ? [Number(latitud), Number(longitud)] : null;

  useEffect(() => {
    const termino = texto.trim();
    if (termino.length < 3) { setSugerencias([]); setBuscandoTexto(false); return undefined; }

    setBuscandoTexto(true);
    setErrorBusqueda('');
    const idActual = ++idPeticion.current;

    const temporizador = setTimeout(async () => {
      try {
        // Se consulta el proxy del backend, no Nominatim directamente:
        // su política de uso exige un User-Agent identificable (que el
        // navegador no permite fijar) y limita a 1 req/s para toda la
        // aplicación. El backend añade ese header, serializa y cachea.
        const { data } = await api.get('/geocodificacion/buscar', { params: { q: termino } });
        if (idPeticion.current !== idActual) return; // llegó una búsqueda más nueva, ignorar esta
        setSugerencias(data.lugares || []);
        setMostrarSugerencias(true);
      } catch {
        if (idPeticion.current !== idActual) return;
        setSugerencias([]);
        setErrorBusqueda('No se pudo buscar el lugar. Intenta de nuevo o márcalo en el mapa.');
      } finally {
        if (idPeticion.current === idActual) setBuscandoTexto(false);
      }
    }, 600); // debounce: respeta el límite de 1 solicitud/segundo de Nominatim

    return () => clearTimeout(temporizador);
  }, [texto]);

  function elegirSugerencia(resultado) {
    const lat = Number(resultado.lat).toFixed(7);
    const lng = Number(resultado.lon).toFixed(7);
    onCambiar(lat, lng);
    if (onLugarSugerido) onLugarSugerido(resultado.display_name);
    setTexto(resultado.display_name);
    setSugerencias([]);
    setMostrarSugerencias(false);
  }

  // Al marcar un punto directamente (clic en el mapa o "usar mi
  // ubicación") solo se tienen coordenadas. Se consulta el nombre del
  // lugar para poder mostrarlo y sugerirlo como lugar de la actividad,
  // en vez de dejar al usuario con un par de números sin contexto.
  async function marcarYNombrar(lat, lng) {
    onCambiar(lat, lng);
    try {
      const { data } = await api.get('/geocodificacion/inverso', { params: { lat, lon: lng } });
      if (data.lugar?.display_name) {
        setTexto(data.lugar.display_name);
        if (onLugarSugerido) onLugarSugerido(data.lugar.display_name);
      }
    } catch {
      // El nombre del lugar es un extra: si no se puede obtener, las
      // coordenadas ya quedaron marcadas y el formulario sigue válido.
    }
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setErrorGeo('Tu navegador no soporta geolocalización.');
      return;
    }
    setBuscandoGeo(true);
    setErrorGeo('');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        marcarYNombrar(posicion.coords.latitude.toFixed(7), posicion.coords.longitude.toFixed(7));
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
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          className="sg-input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          placeholder="Busca una dirección o lugar (ej. Parque Juárez, Tehuacán)"
          aria-label="Buscar dirección o lugar"
          autoComplete="off"
        />
        {buscandoTexto && <span style={styles.indicadorBusqueda}>Buscando…</span>}
        {mostrarSugerencias && sugerencias.length > 0 && (
          <ul style={styles.listaSugerencias}>
            {sugerencias.map((resultado) => (
              <li key={resultado.place_id}>
                <button type="button" style={styles.itemSugerencia} onMouseDown={() => elegirSugerencia(resultado)}>
                  {resultado.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorBusqueda && <p style={{ fontSize: 12, color: 'var(--sg-danger)', marginTop: -4, marginBottom: 8 }}>{errorBusqueda}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>
          {posicion ? 'Ubicación marcada — haz clic de nuevo para moverla.' : 'Busca un lugar arriba o haz clic en el mapa para marcarlo (opcional).'}
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
          <CapturadorClic onClic={(lat, lng) => marcarYNombrar(lat.toFixed(7), lng.toFixed(7))} />
          <CentradorMapa posicion={posicion} />
          {posicion && <Marker position={posicion} />}
        </MapContainer>
      </div>

      {errorGeo && <p style={{ fontSize: 12, color: 'var(--sg-danger)', marginTop: 6 }}>{errorGeo}</p>}

      {posicion && (
        <button type="button" onClick={() => { onCambiar('', ''); setTexto(''); }} style={styles.botonQuitar}>
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

// Cuando la posición cambia por búsqueda o geolocalización (no por clic), recentra el mapa.
function CentradorMapa({ posicion }) {
  const mapa = useMap();
  useEffect(() => {
    if (posicion) mapa.flyTo(posicion, Math.max(mapa.getZoom(), 15));
  }, [posicion && posicion[0], posicion && posicion[1]]); // eslint-disable-line react-hooks/exhaustive-deps
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
  indicadorBusqueda: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    fontSize: 11.5, color: 'var(--sg-ink-soft)', pointerEvents: 'none',
  },
  listaSugerencias: {
    listStyle: 'none', margin: 0, padding: 4, position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
  },
  itemSugerencia: {
    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13,
    background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', color: 'var(--sg-ink)',
  },
};
