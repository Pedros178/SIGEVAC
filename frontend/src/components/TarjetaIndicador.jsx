
/**
 * Tarjeta de indicador (KPI) reutilizable: icono, valor grande y una nota
 * secundaria opcional, con un borde de color a la izquierda a juego con el
 * icono. Pensada para las filas de "resumen ejecutivo" que aparecen en
 * Dashboard, Inventario, Préstamos, Mantenimientos, etc.
 *
 * `tema` selecciona un color de la paleta administrativa (azul cielo por
 * defecto) sin tener que repetir valores hexadecimales en cada página.
 */
const TEMAS = {
  azul: { color: 'var(--sg-primary)', fondo: 'rgba(54, 169, 214, 0.14)' },
  cian: { color: 'var(--sg-secondary)', fondo: 'rgba(8, 127, 168, 0.12)' },
  verde: { color: 'var(--sg-success)', fondo: 'rgba(47, 158, 110, 0.14)' },
  ambar: { color: 'var(--sg-warning)', fondo: 'rgba(224, 115, 28, 0.14)' },
  rojo: { color: 'var(--sg-danger)', fondo: 'rgba(196, 69, 61, 0.14)' },
  morado: { color: '#7C5CBF', fondo: 'rgba(124, 92, 191, 0.14)' },
};

export default function TarjetaIndicador({ icono, valor, etiqueta, nota, tema = 'azul' }) {
  const { color, fondo } = TEMAS[tema] || TEMAS.azul;
  return (
    <div className="sg-stat-card" style={{ borderLeftColor: color }}>
      {icono && (
        <span className="sg-stat-icon" style={{ background: fondo }} aria-hidden="true">
          {icono}
        </span>
      )}
      <div className="sg-stat-valor" style={{ color }}>{valor ?? '—'}</div>
      <div className="sg-stat-etiqueta">{etiqueta}</div>
      {nota && <div className="sg-stat-nota">{nota}</div>}
    </div>
  );
}
