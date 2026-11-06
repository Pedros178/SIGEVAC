import { Link } from 'react-router-dom';

/**
 * Aviso de privacidad (LFPDPPP). PLANTILLA: el texto debe ser revisado y completado por la
 * representación legal de la asociación antes de usarse en producción. El correo de contacto
 * para derechos ARCO y el domicilio se configuran al compilar con VITE_ARCO_CORREO y
 * VITE_ARCO_DOMICILIO (ver frontend/.env.example); la versión se alinea con
 * AVISO_PRIVACIDAD_VERSION del backend.
 */
const CORREO = import.meta.env.VITE_ARCO_CORREO || '';
const DOMICILIO = import.meta.env.VITE_ARCO_DOMICILIO || '';

export default function AvisoPrivacidad() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 24, lineHeight: 1.6 }}>
      <Link to="/solicitud">← Volver</Link>
      <h1>Aviso de privacidad</h1>
      <p>
        La asociación civil responsable de este sistema (SIGEVAC) es la responsable del tratamiento de tus
        datos personales{DOMICILIO ? `, con domicilio en ${DOMICILIO}` : ''}, conforme a la Ley Federal de
        Protección de Datos Personales en Posesión de los Particulares.
      </p>
      <h2>Datos que recabamos</h2>
      <p>
        Identificación y contacto (nombre, correo, teléfono, CURP, domicilio, fecha de nacimiento), datos de un
        tutor si eres menor de edad, contacto de emergencia, documentos de tu expediente, firma electrónica
        simple y fotografía. También datos <strong>sensibles de salud</strong> (tipo de sangre, alergias,
        discapacidad, enfermedades crónicas), solo para atenderte en caso de emergencia; se guardan cifrados.
      </p>
      <h2>Para qué los usamos</h2>
      <p>
        Finalidades necesarias: gestionar tu voluntariado y expediente, registrar asistencia y horas, emitir
        credenciales y constancias, y contactarte. Finalidad opcional: difundir fotografías de actividades
        (puedes negarte sin que afecte tu participación).
      </p>
      <h2>Con quién los compartimos</h2>
      <p>No vendemos tus datos. Solo se comparten con proveedores que alojan el sistema, por obligación legal o con tu consentimiento.</p>
      <h2>Tus derechos (ARCO)</h2>
      <p>
        Puedes Acceder, Rectificar, Cancelar u Oponerte al uso de tus datos y revocar tu consentimiento
        escribiendo a {CORREO ? <a href={`mailto:${CORREO}`}>{CORREO}</a> : 'el correo de contacto de la asociación'}.
        Responderemos en los plazos que marca la ley.
      </p>
      <h2>Cambios</h2>
      <p>Cualquier cambio a este aviso se publicará en esta página.</p>
    </div>
  );
}
