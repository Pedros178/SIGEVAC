import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const COLOR_NIVEL = { bajo: 'var(--sg-success)', medio: 'var(--sg-warning)', alto: 'var(--sg-danger)' };

/**
 * Resumen del modelo de riesgo de abandono para todo el equipo: cuántos
 * voluntarios caen en cada nivel, y los 5 con mayor puntaje, para que el
 * coordinador sepa a quién priorizar sin tener que abrir cada expediente.
 */
export default function PanelRiesgoDashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    api.get('/voluntarios/riesgo/resumen')
      .then(({ data }) => { if (activo) setDatos(data); })
      .catch(() => { if (activo) setError(true); });
    return () => { activo = false; };
  }, []);

  if (error || !datos) return null; // no bloquea el dashboard si el usuario no tiene permiso o aún carga

  const topRiesgo = datos.voluntarios.filter((v) => v.nivel !== 'bajo').slice(0, 5);

  return (
    <section style={styles.tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Voluntarios en riesgo de abandono</h2>
        <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
          <span style={{ color: COLOR_NIVEL.alto, fontWeight: 700 }}>● {datos.resumen.alto} alto</span>
          <span style={{ color: COLOR_NIVEL.medio, fontWeight: 700 }}>● {datos.resumen.medio} medio</span>
          <span style={{ color: COLOR_NIVEL.bajo, fontWeight: 700 }}>● {datos.resumen.bajo} bajo</span>
        </div>
      </div>

      {topRiesgo.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--sg-ink-soft)', margin: 0 }}>Ningún voluntario en riesgo medio o alto por ahora. 🎉</p>
      ) : (
        <div style={styles.lista}>
          {topRiesgo.map((v) => (
            <Link key={v.voluntario_id} to={`/voluntarios/${v.voluntario_id}`} style={styles.fila}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{v.nombre}</span>
              <span style={{ fontSize: 12, color: 'var(--sg-ink-soft)', flex: 1 }}>{v.factor_principal}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR_NIVEL[v.nivel] }}>{v.puntaje} pts</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const styles = {
  tarjeta: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10,
    padding: '18px 20px', marginBottom: 18, boxShadow: '0 4px 18px rgba(22,52,71,.06)',
  },
  lista: { display: 'flex', flexDirection: 'column', gap: 2 },
  fila: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px',
    textDecoration: 'none', color: 'inherit', borderRadius: 6,
  },
};
