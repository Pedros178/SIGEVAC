import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Los endpoints de fotos (inventario, galería) exigen el access token en
 * el header Authorization, así que no se pueden usar en un <img src="...">
 * normal (el navegador no manda ese header en una petición de imagen).
 * Este componente pide la imagen como blob con axios (que sí manda el
 * header) y arma una URL local (`URL.createObjectURL`) para mostrarla.
 */
export default function FotoAutenticada({ ruta, alt, style, onError, marcador = '📦' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelado = false;
    setSrc(null);
    api.get(ruta, { responseType: 'blob' })
      .then((res) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => { if (onError) onError('No se pudo cargar una imagen.'); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) return <span style={{ fontSize: 24, opacity: 0.4 }}>{marcador}</span>;
  return <img src={src} alt={alt || ''} style={style} />;
}
