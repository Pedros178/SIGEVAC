import React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORES_ESTADO = { completo: '#2F9E6E', en_revision: '#F0A800', incompleto: '#C4453D' };

export default function DashboardCharts({ voluntarios, horas, estados }) {
  return (
    <section style={styles.graficas}>
      <div style={styles.panel}><div style={styles.panelTitulo}><div><h2>Altas de voluntariado</h2><span>Últimos seis meses</span></div><span style={styles.icono}>↗</span></div><ResponsiveContainer width="100%" height={230}><AreaChart data={voluntarios} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="voluntariosFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36A9D6" stopOpacity={0.36} /><stop offset="100%" stopColor="#36A9D6" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#D7EAF2" vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(valor) => [valor, 'Voluntarios']} /><Area type="monotone" dataKey="total" stroke="#197DA8" strokeWidth={3} fill="url(#voluntariosFill)" /></AreaChart></ResponsiveContainer></div>
      <div style={styles.panel}><div style={styles.panelTitulo}><div><h2>Horas acumuladas</h2><span>Por periodo mensual</span></div><span style={{ ...styles.icono, color: 'var(--sg-accent)' }}>◒</span></div><ResponsiveContainer width="100%" height={230}><BarChart data={horas} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#D7EAF2" vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(valor) => [valor, 'Horas']} /><Bar dataKey="total" fill="#F0A800" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={styles.panel}><div style={styles.panelTitulo}><div><h2>Salud documental</h2><span>Estado de expedientes</span></div></div><div style={styles.donaWrap}><ResponsiveContainer width="52%" height={180}><PieChart><Pie data={estados} dataKey="total" nameKey="etiqueta" innerRadius={50} outerRadius={76} paddingAngle={4} stroke="none">{estados.map((estado) => <Cell key={estado.estado} fill={COLORES_ESTADO[estado.estado] || '#5B7380'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div style={styles.leyenda}>{estados.map((estado) => <div key={estado.estado} style={styles.leyendaFila}><i style={{ ...styles.punto, background: COLORES_ESTADO[estado.estado] }} /> <span>{estado.etiqueta}</span><strong>{estado.total}</strong></div>)}</div></div></div>
    </section>
  );
}

const styles = {
  graficas: { display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 14 }, panel: { background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10, padding: '19px 18px 10px', minWidth: 0 },
  panelTitulo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, icono: { color: 'var(--sg-primary)', fontSize: 24, lineHeight: 1 }, donaWrap: { display: 'flex', alignItems: 'center', minHeight: 180 }, leyenda: { flex: 1, display: 'grid', gap: 13, fontSize: 12 }, leyendaFila: { display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'center', gap: 6 }, punto: { width: 8, height: 8, borderRadius: '50%' },
};