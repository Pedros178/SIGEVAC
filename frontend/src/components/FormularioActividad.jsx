import { useState } from 'react';
import api from '../services/api';
import SelectorUbicacion from './SelectorUbicacion.jsx';

export default function FormularioActividad({ onCreada, onCancelar }) {
  const [form, setForm] = useState({ nombre: '', fecha: '', horaInicio: '', horaFin: '', estado: 'programada', lugar: '', cupo: '', descripcion: '', latitud: '', longitud: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const payload = {
        ...form,
        cupo: form.cupo ? Number(form.cupo) : undefined,
        latitud: form.latitud !== '' ? Number(form.latitud) : undefined,
        longitud: form.longitud !== '' ? Number(form.longitud) : undefined,
      };
      const { data } = await api.post('/actividades', payload);
      onCreada(data.actividad);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la actividad.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} style={styles.formulario}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Nueva actividad</h2>

      <div style={styles.fila}>
        <Campo etiqueta="Nombre de la actividad" required>
          <input className="sg-input" value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Fecha" required>
          <input type="date" className="sg-input" value={form.fecha} onChange={(e) => actualizar('fecha', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Estado">
          <select className="sg-input" value={form.estado} onChange={(e) => actualizar('estado', e.target.value)}>
            <option value="programada">Programada</option><option value="en_curso">En curso</option><option value="finalizada">Finalizada</option><option value="cancelada">Cancelada</option>
          </select>
        </Campo>
      </div>

      <div style={styles.fila}>
        <Campo etiqueta="Hora de inicio"><input type="time" className="sg-input" value={form.horaInicio} onChange={(e) => actualizar('horaInicio', e.target.value)} /></Campo>
        <Campo etiqueta="Hora de fin"><input type="time" className="sg-input" value={form.horaFin} onChange={(e) => actualizar('horaFin', e.target.value)} /></Campo>
        <Campo etiqueta="Lugar">
          <input className="sg-input" value={form.lugar} onChange={(e) => actualizar('lugar', e.target.value)} />
        </Campo>
        <Campo etiqueta="Cupo">
          <input type="number" min="0" className="sg-input" value={form.cupo} onChange={(e) => actualizar('cupo', e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Descripción">
        <textarea className="sg-input" rows={3} value={form.descripcion} onChange={(e) => actualizar('descripcion', e.target.value)} />
      </Campo>

      <Campo etiqueta="Ubicación en el mapa">
        <SelectorUbicacion
          latitud={form.latitud}
          longitud={form.longitud}
          onCambiar={(lat, lng) => setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }))}
          onLugarSugerido={(direccion) => setForm((prev) => (prev.lugar ? prev : { ...prev, lugar: direccion }))}
        />
      </Campo>

      {error && <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, margin: '12px 0' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="submit" className="sg-button-primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Crear actividad'}
        </button>
        <button type="button" onClick={onCancelar} style={styles.botonCancelar}>Cancelar</button>
      </div>
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
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)',
    padding: 24, marginBottom: 24,
  },
  fila: { display: 'flex', gap: 14, marginBottom: 14 },
  botonCancelar: {
    background: 'transparent', border: '1px solid var(--sg-border)', borderRadius: 10,
    padding: '12px 20px', fontSize: 14, fontWeight: 600, color: 'var(--sg-ink-soft)',
  },
};
