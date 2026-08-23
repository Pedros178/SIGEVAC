import React, { useEffect, useState } from 'react';
import api from '../services/api';
import EscanerDocumento from './EscanerDocumento.jsx';

const PARENTESCOS = ['madre', 'padre', 'tutor', 'abuelo', 'hermano'];

function calcularEsMenor(fechaNacimiento) {
  if (!fechaNacimiento) return false;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - nacimiento.getFullYear()
    - (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate()) ? 1 : 0);
  return edad < 18;
}

export default function FormularioVoluntario({ onCreado, onCancelar }) {
  const [tiposDisponibles, setTiposDisponibles] = useState([]);
  const [form, setForm] = useState({
    nombre: '', apellidoPaterno: '', apellidoMaterno: '', fechaNacimiento: '',
    sexo: '', curp: '', correo: '', telefono: '',
    tutor: { nombre: '', parentesco: '', telefono: '', correo: '' },
    tiposVoluntario: [],
  });
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
      const { data } = await api.post('/voluntarios', payload);
      onCreado(data.voluntario);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar al voluntario.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} style={styles.formulario}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Registrar voluntario</h2>
      <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13.5, marginBottom: 16 }}>
        Se creará automáticamente su expediente digital con los documentos requeridos.
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
        <Campo etiqueta="Fecha de nacimiento" required>
          <input type="date" className="sg-input" value={form.fechaNacimiento} onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Sexo">
          <select className="sg-input" value={form.sexo} onChange={(e) => actualizarCampo('sexo', e.target.value)}>
            <option value="">Selecciona…</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </Campo>
        <Campo etiqueta="Teléfono">
          <input className="sg-input" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Correo electrónico">
        <input type="email" className="sg-input" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} />
      </Campo>

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
          {enviando ? 'Guardando…' : 'Registrar voluntario'}
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
