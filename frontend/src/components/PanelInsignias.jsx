
const COLOR_NIVEL = {
  bronce: '#B08D57',
  plata: '#9AA5B1',
  oro: '#D4A017',
  platino: '#5B8FB9',
};

/**
 * Panel de gamificación: nivel actual (con barra de progreso al siguiente)
 * e insignias obtenidas. Se usa tanto en la vista de administración
 * (VoluntarioDetalle) como en el portal del propio voluntario, por eso
 * no depende de permisos ni de axios directamente — solo recibe datos.
 */
export default function PanelInsignias({ insignias = [], nivel, onRecalcular, recalculando }) {
  const colorNivel = COLOR_NIVEL[nivel?.clave] || COLOR_NIVEL.bronce;

  let porcentajeProgreso = 100;
  if (nivel?.siguiente_nivel) {
    const faltan = nivel.siguiente_nivel.horas_faltantes;
    const totalTramo = faltan + nivel.horas_totales - nivelBaseHoras(nivel.clave);
    porcentajeProgreso = totalTramo > 0
      ? Math.min(100, Math.max(0, ((nivel.horas_totales - nivelBaseHoras(nivel.clave)) / totalTramo) * 100))
      : 100;
  }

  return (
    <div>
      <div style={styles.tarjetaNivel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--sg-ink-soft)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nivel actual</span>
            <div style={{ fontFamily: 'var(--sg-font-display)', fontSize: 24, fontWeight: 600, color: colorNivel }}>
              {nivel?.etiqueta || 'Bronce'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: 'var(--sg-ink-soft)' }}>Horas totales</span>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--sg-ink)' }}>{nivel?.horas_totales ?? 0} h</div>
          </div>
        </div>

        <div style={styles.barraFondo}>
          <div style={{ ...styles.barraRelleno, width: `${porcentajeProgreso}%`, background: colorNivel }} />
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginTop: 8 }}>
          {nivel?.siguiente_nivel
            ? `Faltan ${nivel.siguiente_nivel.horas_faltantes} h para el nivel ${nivel.siguiente_nivel.etiqueta}.`
            : '¡Nivel máximo alcanzado!'}
        </p>

        {onRecalcular && (
          <button
            onClick={onRecalcular}
            disabled={recalculando}
            style={{ ...styles.botonRecalcular, opacity: recalculando ? 0.6 : 1 }}
          >
            {recalculando ? 'Actualizando…' : 'Actualizar insignias'}
          </button>
        )}
      </div>

      <h3 style={{ fontSize: 15, margin: '18px 0 10px' }}>
        Insignias obtenidas {insignias.length > 0 ? `(${insignias.length})` : ''}
      </h3>

      {insignias.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>Todavía no hay insignias. ¡Se otorgan automáticamente al completar actividades!</p>
      ) : (
        <div style={styles.grid}>
          {insignias.map((insignia) => (
            <div key={insignia.id} style={styles.tarjetaInsignia} title={insignia.descripcion}>
              <div style={{ fontSize: 26 }}>{insignia.icono}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, textAlign: 'center' }}>{insignia.nombre}</div>
              <div style={{ fontSize: 10.5, color: 'var(--sg-ink-soft)', marginTop: 2 }}>
                {new Date(insignia.obtenida_en).toLocaleDateString('es-MX')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nivelBaseHoras(clave) {
  const bases = { bronce: 0, plata: 20, oro: 50, platino: 100 };
  return bases[clave] ?? 0;
}

const styles = {
  tarjetaNivel: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    padding: 18,
  },
  barraFondo: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    background: 'var(--sg-border)',
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.4s ease',
  },
  botonRecalcular: {
    marginTop: 14,
    fontSize: 12.5,
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid var(--sg-primary)',
    color: 'var(--sg-primary)',
    background: 'transparent',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
    gap: 10,
  },
  tarjetaInsignia: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 12,
    padding: '14px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};
