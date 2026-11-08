import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

/**
 * Aviso de privacidad INTEGRAL conforme al art. 15 de la Ley Federal de Protección de Datos Personales en Posesión
 * de los Particulares (DOF 20-mar-2025): identidad y domicilio del responsable; datos tratados (señalando los
 * sensibles); finalidades (distinguiendo las que requieren consentimiento); opciones para limitar el uso o la
 * divulgación; mecanismos para ejercer los derechos ARCO; y cómo se comunicarán los cambios al aviso.
 *
 * Los datos propios de cada asociación (domicilio, correo ARCO, persona designada, versión) se capturan en
 * Administración y se leen de la API; mientras falten, el aviso lo muestra con una advertencia.
 * El texto debe ser revisado por la representación legal de la asociación antes de usarse.
 */
export default function AvisoPrivacidad() {
  const [params] = useSearchParams();
  const [asociaciones, setAsociaciones] = useState(null);
  const [asociacionId, setAsociacionId] = useState(params.get('asociacion') || '');
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (asociacionId) return;
    api.get('/asociacion/publicas')
      .then(({ data }) => {
        setAsociaciones(data.asociaciones);
        if (data.asociaciones.length === 1) setAsociacionId(data.asociaciones[0].id);
      })
      .catch(() => setError('No se pudo cargar la información de la asociación.'));
  }, [asociacionId]);

  useEffect(() => {
    if (!asociacionId) return;
    api.get('/publico/aviso-privacidad', { params: { asociacion_id: asociacionId } })
      .then(({ data }) => setAviso(data.aviso))
      .catch(() => setError('No se pudo cargar el aviso de privacidad.'));
  }, [asociacionId]);

  const caja = { maxWidth: 780, margin: '0 auto', padding: 24, lineHeight: 1.65 };

  if (!asociacionId) {
    return (
      <div style={caja}>
        <Link to="/solicitud">← Volver</Link>
        <h1>Aviso de privacidad</h1>
        {error && <p role="alert">{error}</p>}
        {asociaciones && asociaciones.length > 1 && (
          <label>Selecciona la asociación:{' '}
            <select value={asociacionId} onChange={(e) => setAsociacionId(e.target.value)}>
              <option value="">—</option>
              {asociaciones.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  }
  if (!aviso) return <div style={caja}>{error ? <p role="alert">{error}</p> : 'Cargando…'}</div>;

  const contacto = aviso.correo_arco
    ? <a href={`mailto:${aviso.correo_arco}`}>{aviso.correo_arco}</a>
    : <em>(correo pendiente de capturar por la asociación)</em>;

  return (
    <div style={caja}>
      <Link to="/solicitud">← Volver</Link>
      <h1>Aviso de privacidad integral</h1>
      <p><small>Versión {aviso.version_aviso}</small></p>

      {!aviso.completo && (
        <p role="alert" style={{ border: '1px solid #b42318', color: '#b42318', borderRadius: 8, padding: 12 }}>
          <strong>Aviso incompleto.</strong> La asociación todavía no ha capturado su domicilio, el correo para derechos ARCO o la persona designada
          (Administración → Privacidad). Hasta entonces no debería usarse para recabar datos.
        </p>
      )}

      <h2>1. Responsable</h2>
      <p>
        <b>{aviso.responsable}</b>{aviso.domicilio ? <>, con domicilio en {aviso.domicilio}</> : <em>, domicilio pendiente de capturar</em>}, es
        responsable del tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        Persona designada para atender tus solicitudes (art. 29): {aviso.persona_designada || <em>pendiente de designar</em>}.
      </p>

      <h2>2. Datos personales que tratamos</h2>
      <ul>
        <li><b>Identificación y contacto:</b> nombre, fecha de nacimiento, sexo, CURP, estado civil, número de control, domicilio, teléfonos, correo y fotografía.</li>
        <li><b>Tutor</b> (si eres menor de edad): nombre, CURP, identificación, teléfono, correo y parentesco.</li>
        <li><b>Contacto de emergencia.</b></li>
        <li><b>Expediente:</b> documentos que entregas y firmas electrónicas simples (con fecha, dirección IP y dispositivo desde donde firmas).</li>
        <li><b>Participación:</b> asistencia, horas de servicio, insignias, préstamos de inventario y cuotas.</li>
        <li>
          <b>Datos personales SENSIBLES (estado de salud):</b> tipo de sangre, alergias, discapacidad y enfermedades crónicas. Solo los tratamos con tu
          consentimiento expreso y por escrito (art. 8), y los guardamos cifrados.
        </li>
      </ul>

      <h2>3. Finalidades</h2>
      <p><b>Necesarias para la relación contigo</b> (no requieren tu consentimiento adicional):</p>
      <ul>
        <li>Gestionar tu registro como voluntario y tu expediente.</li>
        <li>Registrar asistencia y horas, y emitir credenciales, constancias y certificados con código QR verificable.</li>
        <li>Contactarte por correo o WhatsApp sobre actividades y trámites.</li>
        <li>Administrar inventario y cuotas, y mantener la seguridad y auditoría del sistema.</li>
        <li>Calcular alertas internas de riesgo de abandono para que el equipo pueda apoyarte; no se toman decisiones automatizadas con efectos sobre ti.</li>
      </ul>
      <p><b>Que SÍ requieren tu consentimiento:</b></p>
      <ul>
        <li><b>Datos de salud</b> (sensibles): para atenderte en una emergencia durante las actividades. Consentimiento expreso y por escrito.</li>
        <li><b>Difusión de fotografías</b> de actividades donde aparezcas, en la página pública y medios de la asociación.</li>
      </ul>

      <h2>4. Cómo limitar el uso o la divulgación de tus datos</h2>
      <p>
        Puedes negarte a la difusión de fotografías y a que guardemos tus datos de salud sin que eso afecte tu participación, pedirnos que no te escribamos
        por WhatsApp o correo, o revocar un consentimiento en cualquier momento (sin efectos retroactivos). Si revocas el de datos de salud, los eliminamos.
        {aviso.medios_limitar_uso ? ` ${aviso.medios_limitar_uso}` : ''} Escríbenos a {contacto}.
      </p>

      <h2>5. Derechos ARCO: acceso, rectificación, cancelación y oposición</h2>
      <p>Para ejercerlos presenta una solicitud en {contacto}{aviso.domicilio ? <> o en {aviso.domicilio}</> : null}{aviso.telefono_arco ? <>, o al teléfono {aviso.telefono_arco}</> : null}, con:</p>
      <ul>
        <li>tu nombre y un medio para recibir la respuesta;</li>
        <li>copia de tu identificación (o la de tu representante y su personalidad);</li>
        <li>la descripción clara de los datos y del derecho que quieres ejercer (en rectificación, las correcciones y documentos que las sustenten).</li>
      </ul>
      <p>
        Te responderemos en un máximo de <b>20 días hábiles</b>; si procede, lo haremos efectivo dentro de los <b>15 días hábiles</b> siguientes. Ambos
        plazos pueden ampliarse una sola vez por un periodo igual si las circunstancias lo justifican. El ejercicio de tus derechos es <b>gratuito</b>;
        solo podrían cobrarse costos de reproducción o envío. Si cancelas tus datos, primero se bloquean durante el plazo legal de conservación y luego se suprimen.
      </p>
      <p>
        Si no estás conforme con la respuesta o no la recibes, puedes presentar una solicitud de protección de datos ante la <b>Secretaría Anticorrupción
        y Buen Gobierno</b> dentro de los 15 días siguientes a la respuesta (o al vencer el plazo sin respuesta).
      </p>

      <h2>6. Transferencias y proveedores</h2>
      <p>
        No transferimos tus datos a terceros, salvo en los casos que la Ley permite sin consentimiento (art. 36) o cuando tú lo autorices por separado:
        al aceptar este aviso <b>no</b> autorizas transferencias. Usamos proveedores que tratan datos por cuenta de la asociación (alojamiento del sistema y de
        la base de datos, correo electrónico y mensajería de WhatsApp), que no pueden usarlos para fines propios.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Aplicamos medidas administrativas, técnicas y físicas: acceso por roles y asociación, contraseñas protegidas, autenticación en dos pasos opcional, cifrado
        de los datos de salud y de los respaldos, y bitácora de accesos. Si ocurriera una vulneración que afecte de forma significativa tus derechos, te lo
        informaremos de inmediato.
      </p>

      <h2>8. Cambios a este aviso</h2>
      <p>
        Publicaremos cualquier cambio en esta página con una nueva versión y fecha, y te lo comunicaremos por correo o dentro del sistema. Si cambian las
        finalidades para las que usamos tus datos, te pediremos de nuevo tu consentimiento (art. 11).
      </p>
    </div>
  );
}
