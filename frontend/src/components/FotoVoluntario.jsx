import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Muestra la fotografía de un voluntario. Como /uploads no se expone como
 * carpeta estática (por seguridad), la imagen se trae autenticada vía
 * axios (igual que cualquier otro endpoint) y se renderiza como blob URL,
 * en vez de usar un <img src="..."> directo que no llevaría el token.
 */
export default function FotoVoluntario({ voluntarioId, tieneFoto, size = 96, refrescarKey }) {
  const [url, setUrl] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    if (!tieneFoto) {
      setUrl(null);
      return undefined;
    }
    setCargando(true);
    api.get(`/voluntarios/${voluntarioId}/foto`, { responseType: 'blob' })
      .then(({ data }) => {
        objectUrl = window.URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null))
      .finally(() => setCargando(false));

    return () => { if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
     
  }, [voluntarioId, tieneFoto, refrescarKey]);

  const estiloBase = {
    width: size, height: size, borderRadius: '50%', objectFit: 'cover',
    background: 'var(--sg-bg)', border: '2px solid var(--sg-border)', flexShrink: 0,
  };

  if (url) return <img src={url} alt="Fotografía del voluntario" style={estiloBase} />;

  return (
    <div style={{
      ...estiloBase, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--sg-ink-soft)', fontSize: size / 4, fontWeight: 700,
    }}>
      {cargando ? '…' : 'SIN FOTO'}
    </div>
  );
}
