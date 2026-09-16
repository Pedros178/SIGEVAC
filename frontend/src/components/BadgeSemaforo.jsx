
const CONFIG = {
  completo: { clase: 'sg-badge-success', etiqueta: '🟢 Completo' },
  en_revision: { clase: 'sg-badge-warning', etiqueta: '🟡 En revisión' },
  incompleto: { clase: 'sg-badge-danger', etiqueta: '🔴 Incompleto' },
};

export default function BadgeSemaforo({ estado, porcentaje }) {
  const config = CONFIG[estado] || CONFIG.incompleto;
  return (
    <span className={`sg-badge ${config.clase}`}>
      {config.etiqueta}
      {typeof porcentaje === 'number' ? ` · ${porcentaje}%` : ''}
    </span>
  );
}
