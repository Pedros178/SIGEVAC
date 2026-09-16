import { useEffect, useState } from 'react';
import api from '../services/api';
import EscanerDocumento from './EscanerDocumento.jsx';
import SelectorUbicacionCatalogo from './SelectorUbicacionCatalogo.jsx';

const PARENTESCOS = ['madre', 'padre', 'tutor', 'abuelo', 'hermano'];

function calcularEsMenor(fechaNacimiento) {
  if (!fechaNacimiento) return false;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - nacimiento.getFullYear()
    - (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate()) ? 1 : 0);
  return edad < 18;
}

export default function FormularioVoluntario({ onCreado, onActualizado, onCancelar, voluntarioInicial = null, modoEdicion = false }) {
  const [tiposDisponibles, setTiposDisponibles] = useState([]);
  const [form, setForm] = useState(() => ({
    nombre: '', apellidoPaterno: '', apellidoMaterno: '', numeroControl: '', fechaNacimiento: '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    sexo: '', curp: '', correo: '', telefono: '', telefonoFijo: '', telefonoCelular: '', colonia: '',
    discapacidad: '', enfermedadCronica: '', direccion: '', estado: '', municipio: '',
    contactoEmergenciaNombre: '', contactoEmergenciaDomicilio: '', contactoEmergenciaColonia: '',
    contactoEmergenciaMunicipio: '', contactoEmergenciaEstado: '', contactoEmergenciaTelefonoFijo: '',
    contactoEmergenciaTelefonoCelular: '', contactoEmergenciaCorreo: '', contactoEmergenciaParentesco: '',
    tutor: { nombre: '', parentesco: '', telefono: '', correo: '' },
    tiposVoluntario: [],
    ...(voluntarioInicial ? {
      nombre: voluntarioInicial.nombre || '', apellidoPaterno: voluntarioInicial.apellido_paterno || '', apellidoMaterno: voluntarioInicial.apellido_materno || '', numeroControl: voluntarioInicial.numero_control || '',
      fechaNacimiento: voluntarioInicial.fecha_nacimiento?.slice(0, 10) || '', fechaIngreso: voluntarioInicial.fecha_ingreso?.slice(0, 10) || '', sexo: voluntarioInicial.sexo || '', curp: voluntarioInicial.curp || '',
      correo: voluntarioInicial.correo || '', telefono: voluntarioInicial.telefono || '', telefonoFijo: voluntarioInicial.telefono_fijo || '', telefonoCelular: voluntarioInicial.telefono_celular || '', colonia: voluntarioInicial.colonia || '',
      discapacidad: voluntarioInicial.discapacidad || '', enfermedadCronica: voluntarioInicial.enfermedad_cronica || '', direccion: voluntarioInicial.direccion || '', estado: voluntarioInicial.estado_nombre || '', municipio: voluntarioInicial.municipio_nombre || '',
      contactoEmergenciaNombre: voluntarioInicial.contacto_emergencia_nombre || '', contactoEmergenciaDomicilio: voluntarioInicial.contacto_emergencia_domicilio || '', contactoEmergenciaColonia: voluntarioInicial.contacto_emergencia_colonia || '',
      contactoEmergenciaMunicipio: voluntarioInicial.contacto_emergencia_municipio || '', contactoEmergenciaEstado: voluntarioInicial.contacto_emergencia_estado || '', contactoEmergenciaTelefonoFijo: voluntarioInicial.contacto_emergencia_telefono_fijo || '',
      contactoEmergenciaTelefonoCelular: voluntarioInicial.contacto_emergencia_telefono_celular || '', contactoEmergenciaCorreo: voluntarioInicial.contacto_emergencia_correo || '', contactoEmergenciaParentesco: voluntarioInicial.contacto_emergencia_parentesco || '',
      tutor: voluntarioInicial.tutor ? { nombre: voluntarioInicial.tutor.nombre || '', parentesco: voluntarioInicial.tutor.parentesco || '', telefono: voluntarioInicial.tutor.telefono || '', correo: voluntarioInicial.tutor.correo || '' } : { nombre: '', parentesco: '', telefono: '', correo: '' },
      tiposVoluntario: (voluntarioInicial.tipos || []).map((tipo) => tipo.clave),
    } : {}),
  }));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [escaneandoCurp, setEscaneandoCurp] = useState(false);

  useEffect(() => {
    api.get('/voluntarios/tipos/disponibles').then(({ data }) => setTiposDisponibles(data.tipos)).catch(() => {});
  }, []);

  const esMenor = calcularEsMenor(form.fechaNacimiento);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarTutor(campo, valor) {
    setForm((prev) => ({ ...prev, tutor: { ...prev.tutor, [campo]: valor } }));
  }

  function alternarTipo(clave) {
    setForm((prev) => ({
      ...prev,
      tiposVoluntario: prev.tiposVoluntario.includes(clave)
        ? prev.tiposVoluntario.filter((c) => c !== clave)
        : [...prev.tiposVoluntario, clave],
    }));
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');

    if (esMenor && !form.tutor.nombre) {
      setError('Este voluntario es menor de edad: los datos del tutor son obligatorios.');
      return;
    }

    setEnviando(true);
    try {
      const payload = { ...form };
      if (!esMenor) delete payload.tutor;
      const { data } = modoEdicion
        ? await api.put(`/voluntarios/${voluntarioInicial.id}`, payload)
        : await api.post('/voluntarios', payload);
      if (modoEdicion) onActualizado(data.voluntario);
      else onCreado(data.voluntario);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar al voluntario.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} style={styles.formulario}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{modoEdicion ? 'Editar información del voluntario' : 'Registrar voluntario'}</h2>
      <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13.5, marginBottom: 16 }}>
        {modoEdicion ? 'Actualiza los datos que hayan cambiado o completa la información faltante.' : 'Se creará automáticamente su expediente digital con los documentos requeridos.'}
      </p>

      <div style={styles.fila}>
        <Campo etiqueta="Nombre(s)" required>
          <input className="sg-input" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Apellido paterno">
          <input className="sg-input" value={form.apellidoPaterno} onChange={(e) => actualizarCampo('apellidoPaterno', e.target.value)} />
        </Campo>
        <Campo etiqueta="Apellido materno">
          <input className="sg-input" value={form.apellidoMaterno} onChange={(e) => actualizarCampo('apellidoMaterno', e.target.value)} />
        </Campo>
      </div>

      <div style={styles.fila}>
        <Campo etiqueta="Número de control">
          <input className="sg-input" value={form.numeroControl} onChange={(e) => actualizarCampo('numeroControl', e.target.value)} placeholder="Ej. SS-2026-001" />
        </Campo>
        <Campo etiqueta="Discapacidad">
          <input className="sg-input" value={form.discapacidad} onChange={(e) => actualizarCampo('discapacidad', e.target.value)} placeholder="Ninguna o especificar" />
        </Campo>
        <Campo etiqueta="Enfermedad crónica">
          <input className="sg-input" value={form.enfermedadCronica} onChange={(e) => actualizarCampo('enfermedadCronica', e.target.value)} placeholder="Ninguna o especificar" />
        </Campo>
      </div>

      <div style={styles.fila}>
        <Campo etiqueta="Fecha de nacimiento" required>
          <input type="date" className="sg-input" value={form.fechaNacimiento} onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Fecha de ingreso" required>
          <input type="date" className="sg-input" value={form.fechaIngreso} onChange={(e) => actualizarCampo('fechaIngreso', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Sexo">
          <select className="sg-input" value={form.sexo} onChange={(e) => actualizarCampo('sexo', e.target.value)}>
            <option value="">Selecciona…</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </Campo>
        <Campo etiqueta="Teléfono fijo">
          <input className="sg-input" value={form.telefonoFijo} onChange={(e) => actualizarCampo('telefonoFijo', e.target.value)} />
        </Campo>
        <Campo etiqueta="Teléfono celular">
          <input className="sg-input" value={form.telefonoCelular} onChange={(e) => actualizarCampo('telefonoCelular', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Correo electrónico">
        <input type="email" className="sg-input" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
      </Campo>

      <div style={styles.fila}>
        <Campo etiqueta="Domicilio">
          <input className="sg-input" value={form.direccion} onChange={(e) => actualizarCampo('direccion', e.target.value)} />
        </Campo>
        <Campo etiqueta="Colonia">
          <input className="sg-input" value={form.colonia} onChange={(e) => actualizarCampo('colonia', e.target.value)} />
        </Campo>
      </div>

      <div style={styles.fila}>
        <Campo etiqueta="Ubicación">
          <SelectorUbicacionCatalogo estado={form.estado} municipio={form.municipio} onEstadoChange={(valor) => actualizarCampo('estado', valor)} onMunicipioChange={(valor) => actualizarCampo('municipio', valor)} compacto />
        </Campo>
      </div>

      <Campo etiqueta="CURP">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="sg-input"
            value={form.curp}
            onChange={(e) => actualizarCampo('curp', e.target.value.toUpperCase())}
            style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
            maxLength={18}
            placeholder="18 caracteres"
          />
          <button
            type="button"
            onClick={() => setEscaneandoCurp(true)}
            style={{ ...styles.botonCancelar, padding: '0 14px', whiteSpace: 'nowrap' }}
          >
            📷 Escanear
          </button>
        </div>
      </Campo>

      {form.fechaNacimiento && (
        <div style={{ marginBottom: 4 }}>
          <span className={`sg-badge ${esMenor ? 'sg-badge-warning' : 'sg-badge-success'}`}>
            {esMenor ? 'Menor de edad — requiere tutor' : 'Mayor de edad'}
          </span>
        </div>
      )}

      {esMenor && (
        <div style={styles.bloqueTutor}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Datos del tutor (Módulo 6)</h3>
          <div style={styles.fila}>
            <Campo etiqueta="Nombre del tutor" required>
              <input className="sg-input" value={form.tutor.nombre} onChange={(e) => actualizarTutor('nombre', e.target.value)} required={esMenor} />
            </Campo>
            <Campo etiqueta="Parentesco">
              <select className="sg-input" value={form.tutor.parentesco} onChange={(e) => actualizarTutor('parentesco', e.target.value)}>
                <option value="">Selecciona…</option>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Teléfono del tutor">
              <input className="sg-input" value={form.tutor.telefono} onChange={(e) => actualizarTutor('telefono', e.target.value)} />
            </Campo>
          </div>
        </div>
      )}

      <div style={styles.bloqueEmergencia}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Contacto de emergencia</h3>
        <div style={styles.fila}>
          <Campo etiqueta="Nombre completo">
            <input className="sg-input" value={form.contactoEmergenciaNombre} onChange={(e) => actualizarCampo('contactoEmergenciaNombre', e.target.value)} />
          </Campo>
          <Campo etiqueta="Parentesco">
            <input className="sg-input" value={form.contactoEmergenciaParentesco} onChange={(e) => actualizarCampo('contactoEmergenciaParentesco', e.target.value)} />
          </Campo>
        </div>
        <div style={styles.fila}>
          <Campo etiqueta="Domicilio"><input className="sg-input" value={form.contactoEmergenciaDomicilio} onChange={(e) => actualizarCampo('contactoEmergenciaDomicilio', e.target.value)} /></Campo>
          <Campo etiqueta="Colonia"><input className="sg-input" value={form.contactoEmergenciaColonia} onChange={(e) => actualizarCampo('contactoEmergenciaColonia', e.target.value)} /></Campo>
          <Campo etiqueta="Ubicación">
            <SelectorUbicacionCatalogo estado={form.contactoEmergenciaEstado} municipio={form.contactoEmergenciaMunicipio} onEstadoChange={(valor) => actualizarCampo('contactoEmergenciaEstado', valor)} onMunicipioChange={(valor) => actualizarCampo('contactoEmergenciaMunicipio', valor)} compacto />
          </Campo>
        </div>
        <div style={styles.fila}>
          <Campo etiqueta="Teléfono fijo"><input className="sg-input" value={form.contactoEmergenciaTelefonoFijo} onChange={(e) => actualizarCampo('contactoEmergenciaTelefonoFijo', e.target.value)} /></Campo>
          <Campo etiqueta="Teléfono celular"><input className="sg-input" value={form.contactoEmergenciaTelefonoCelular} onChange={(e) => actualizarCampo('contactoEmergenciaTelefonoCelular', e.target.value)} /></Campo>
          <Campo etiqueta="Correo electrónico"><input type="email" className="sg-input" value={form.contactoEmergenciaCorreo} onChange={(e) => actualizarCampo('contactoEmergenciaCorreo', e.target.value)} /></Campo>
        </div>
      </div>

      <div style={{ marginTop: 6, marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)', marginBottom: 8 }}>
          Clasificación (Módulo 5) — opcional
        </div>
        <div style={styles.chips}>
          {tiposDisponibles.map((tipo) => (
            <label key={tipo.clave} style={styles.chip}>
              <input
                type="checkbox"
                checked={form.tiposVoluntario.includes(tipo.clave)}
                onChange={() => alternarTipo(tipo.clave)}
              />
              {tipo.etiqueta}
            </label>
          ))}
        </div>
      </div>

      {error && <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="sg-button-primary" disabled={enviando}>
          {enviando ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Registrar voluntario'}
        </button>
        <button type="button" onClick={onCancelar} style={styles.botonCancelar}>
          Cancelar
        </button>
      </div>

      {escaneandoCurp && (
        <EscanerDocumento
          ofrecerLecturaCurp
          onCancelar={() => setEscaneandoCurp(false)}
          onConfirmar={(archivo, curpDetectado) => {
            setEscaneandoCurp(false);
            if (curpDetectado) actualizarCampo('curp', curpDetectado);
            // Aquí solo nos interesa el CURP leído; la foto escaneada del
            // documento de identidad se sube después, ya en el expediente
            // del voluntario (una vez que exista su registro).
          }}
        />
      )}
    </form>
  );
}

function Campo({ etiqueta, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)', flex: 1 }}>
      {etiqueta}{required && ' *'}
      {children}
    </label>
  );
}

const styles = {
  formulario: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    padding: 24,
    marginBottom: 24,
  },
  fila: { display: 'flex', gap: 14, marginBottom: 14 },
  bloqueTutor: {
    background: 'rgba(242, 169, 59, 0.08)',
    border: '1px solid rgba(242, 169, 59, 0.35)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  bloqueEmergencia: {
    background: 'rgba(54, 169, 214, 0.06)', border: '1px solid var(--sg-border)', borderRadius: 10, padding: 16, marginBottom: 16,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    border: '1px solid var(--sg-border)',
    borderRadius: 999,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  botonCancelar: {
    background: 'transparent',
    border: '1px solid var(--sg-border)',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--sg-ink-soft)',
  },
};
