import React from 'react';

/**
 * Barra de estado del modo offline. Solo se muestra cuando hay algo que
 * comunicar (sin conexión, o hay acciones pendientes de sincronizar) —
 * cuando todo está normal y al día, no ocupa espacio en la pantalla.
 */
export default function IndicadorConexion({ enLinea, pendientes, sincronizando, onSincronizar }) {
  if (enLinea && pendientes === 0 && !sincronizando) return null;

  const estilo = !enLinea ? styles.sinConexion : styles.pendiente;
  const mensaje = !enLinea
    ? `Sin conexión — los registros se guardan en este dispositivo${pendientes > 0 ? ` (${pendientes} pendiente${pendientes === 1 ? '' : 's'})` : ''}.`
    : sincronizando
      ? 'Sincronizando registros guardados sin conexión…'
      : `${pendientes} registro${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de sincronizar.`;

  return (
    <div style={{ ...styles.barra, ...estilo }}>
      <span>{!enLinea ? '📴' : '🔄'} {mensaje}</span>
      {enLinea && pendientes > 0 && !sincronizando && (
        <button type="button" onClick={onSincronizar} style={styles.boton}>Sincronizar ahora</button>
      )}
    </div>
  );
}

const styles = {
  barra: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16,
  },
  sinConexion: { background: 'rgba(224, 164, 0, 0.14)', color: '#8A5A00' },
  pendiente: { background: 'rgba(54, 169, 214, 0.12)', color: 'var(--sg-primary-dark)' },
  boton: {
    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 7,
    border: '1px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
