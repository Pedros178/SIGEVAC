import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import marcadorIcono2x from 'leaflet/dist/images/marker-icon-2x.png';
import marcadorIcono from 'leaflet/dist/images/marker-icon.png';
import marcadorSombra from 'leaflet/dist/images/marker-shadow.png';

// Leaflet busca los íconos por defecto en rutas relativas que no
// funcionan con el empaquetado de Vite; se resuelven explícitamente
// para que el marcador no salga roto.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marcadorIcono2x,
  iconUrl: marcadorIcono,
  shadowUrl: marcadorSombra,
});

const CENTRO_PUEBLA = [19.0414, -98.2063]; // fallback: estado de Puebla, sede típica de la asociación

/**
 * Mapa interactivo con un marcador por cada actividad que tenga
 * latitud/longitud. Si ninguna actividad tiene ubicación, se muestra
 * el mensaje correspondiente en vez de un mapa vacío y confuso.
 */
export default function MapaActividades({ actividades = [], altura = 420 }) {
  const conUbicacion = actividades.filter((a) => a.latitud != null && a.longitud != null);

  if (conUbicacion.length === 0) {
    return (
      <div style={{ ...styles.vacio, height: altura }}>
        <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          Ninguna actividad tiene ubicación registrada todavía.<br />
          Agrega latitud y longitud al crear o editar una actividad para verla aquí.
        </p>
      </div>
    );
  }

  const centro = [
    conUbicacion.reduce((acc, a) => acc + Number(a.latitud), 0) / conUbicacion.length,
    conUbicacion.reduce((acc, a) => acc + Number(a.longitud), 0) / conUbicacion.length,
  ];

  return (
    <div style={{ height: altura, borderRadius: 'var(--sg-radius)', overflow: 'hidden', border: '1px solid var(--sg-border)' }}>
      <MapContainer center={centro} zoom={conUbicacion.length === 1 ? 14 : 11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {conUbicacion.map((actividad) => (
          <Marker key={actividad.id} position={[Number(actividad.latitud), Number(actividad.longitud)]}>
            <Popup>
              <strong>{actividad.nombre}</strong>
              <br />
              {new Date(actividad.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
              {actividad.lugar && <><br />{actividad.lugar}</>}
              <br />
              <Link to={`/actividades/${actividad.id}`}>Ver detalle →</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export { CENTRO_PUEBLA };

const styles = {
  vacio: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--sg-bg)', border: '1px dashed var(--sg-border)', borderRadius: 'var(--sg-radius)',
  },
};
