import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

/**
 * Aviso de privacidad SIMPLIFICADO (art. 16, fr. II de la Ley): cuando los datos se recaban por medios electrónicos,
 * debe mostrarse al menos (I) identidad y domicilio del responsable, (II) datos tratados, señalando los sensibles,
 * (III) finalidades, distinguiendo las que requieren consentimiento, (IV) opciones para limitar el uso o divulgación,
 * y el sitio donde consultar el aviso integral.
 */
export default function AvisoSimplificado({ asociacionId }) {
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setAviso(null);
    if (!asociacionId) return;
    api.get('/publico/aviso-privacidad', { params: { asociacion_id: asociacionId } })
      .then(({ data }) => setAviso(data.aviso))
      .catch(() => setAviso(null));
  }, [asociacionId]);

  if (!asociacionId) return null;
  return (
    <section aria-label="Aviso de privacidad simplificado" style={{ border: '1px solid var(--sg-line, #d0d5dd)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.5 }}>
      <strong>Aviso de privacidad (versión simplificada)</strong>
      <p style={{ margin: '6px 0' }}>
        <b>Responsable:</b> {aviso?.responsable || 'la asociación civil seleccionada'}
        {aviso?.domicilio ? `, con domicilio en ${aviso.domicilio}` : ''}.
      </p>
      <p style={{ margin: '6px 0' }}>
        <b>Datos que pedimos aquí:</b> nombre, correo, teléfono y tu mensaje. No pedimos datos sensibles en este formulario.
      </p>
      <p style={{ margin: '6px 0' }}>
        <b>Para qué los usamos (necesarias):</b> evaluar tu solicitud de voluntariado y contactarte. No usamos estos datos para otras finalidades sin pedirte
        antes tu consentimiento.
      </p>
      <p style={{ margin: '6px 0' }}>
        <b>Tus opciones:</b> puedes limitar el uso de tus datos, o ejercer tus derechos de acceso, rectificación, cancelación y oposición (ARCO) y revocar tu
        consentimiento{aviso?.correo_arco ? <> escribiendo a <a href={`mailto:${aviso.correo_arco}`}>{aviso.correo_arco}</a></> : ' con la asociación'}.
      </p>
      <p style={{ margin: '6px 0 0' }}>
        Consulta el <Link to={`/aviso-privacidad?asociacion=${asociacionId}`} target="_blank" rel="noopener noreferrer">aviso de privacidad integral</Link>.
      </p>
      {aviso && !aviso.completo && (
        <p role="alert" style={{ margin: '8px 0 0', color: '#b42318' }}>
          Aviso incompleto: la asociación aún no ha capturado su domicilio, correo ARCO o persona designada.
        </p>
      )}
    </section>
  );
}
