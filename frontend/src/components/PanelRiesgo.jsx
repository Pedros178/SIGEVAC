import React from 'react';

const COLOR_NIVEL = { bajo: 'var(--sg-success)', medio: 'var(--sg-warning)', alto: 'var(--sg-danger)' };
const FONDO_NIVEL = { bajo: 'rgba(47,158,110,0.08)', medio: 'rgba(240,168,0,0.1)', alto: 'rgba(196,69,61,0.08)' };

/**
 * Muestra el puntaje de riesgo de abandono y su desglose por criterio.
 * El modelo es un scoring por reglas ponderadas y explicables (ver
 * backend/src/services/riesgoService.js) — por eso aquí se puede mostrar
 * exactamente qué factores están pesando, no solo un número.
 */
export default function PanelRiesgo({ riesgo }) {
  if (!riesgo) return null;
  const color = COLOR_NIVEL[riesgo.nivel] || COLOR_NIVEL.bajo;

  return (
    <div style={{ ...styles.tarjeta, background: FONDO_NIVEL[riesgo.nivel] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--sg-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Riesgo de abandono</span>
          <div style={{ fontFamily: 'var(--sg-font-display)', fontSize: 22, fontWeight: 600, color }}>{riesgo.nivel_etiqueta}</div>
        </div>
        <div style={{ ...styles.circulo, borderColor: color, color }}>{riesgo.puntaje}</div>
      </div>

      {riesgo.desglose.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginTop: 10, marginBottom: 0 }}>
          Sin factores de riesgo detectados. ✅
        </p>
      ) : (
        <ul style={styles.lista}>
          {riesgo.desglose.map((factor) => (
            <li key={factor.criterio} style={styles.item}>
              <span>{factor.etiqueta}</span>
              <span style={{ fontWeight: 700, color }}>+{factor.puntos}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  tarjeta: { border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', padding: 18 },
  circulo: {
    width: 52, height: 52, borderRadius: '50%', border: '3px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, background: 'var(--sg-surface)',
  },
  lista: { listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 6 },
  item: { display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 12 },
};
