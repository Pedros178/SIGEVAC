import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const AREAS_DE_LABOR = [
  'Arte y Cultura', 'Deporte', 'Labor Social', 'Ciencia y Tecnología', 'Educación', 'Salud',
  'Recursos Naturales y Medio Ambiente', 'Jurídica', 'Desarrollo Rural',
  'Apoyo al Comercio y Emprendimiento', 'Inclusión y Participación Cívica', 'Comunicación',
  'Centros de Desarrollo Integral Comunitarios', 'Diversidad Sexual', 'Recreación',
  'Pueblos y Barrios Originarios', 'Gestión Financiera', 'Vinculación y Empleabilidad',
  'Difusión Gastronómica',
];

const ESTADOS_CON_PRESENCIA = ['Tlaxcala', 'Puebla', 'Estado de México', 'CDMX', 'Querétaro', 'Chiapas', 'Hidalgo'];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return { dia: Number(dia), mes: MESES[Number(mes) - 1], anio };
}

export default function Home() {
  const [actividades, setActividades] = useState(null);
  const [errorActividades, setErrorActividades] = useState(false);

  useEffect(() => {
    api.get('/publico/actividades')
      .then(({ data }) => setActividades(data.actividades))
      .catch(() => setErrorActividades(true));
  }, []);

  return (
    <div style={styles.pagina}>
      <EncabezadoPublico />

      <section style={styles.hero}>
        <div style={styles.heroContenido}>
          <img src="/logo-sigevac.png" alt="" style={styles.heroLogo} />
          <div>
            <p style={styles.heroEyebrow}>Asociación Juvenil</p>
            <h1 style={styles.heroTitulo}>Sueños de Comedia</h1>
            <p style={styles.heroLema}>
              «Participación e iniciativa juvenil al servicio de la sociedad»
            </p>
            <p style={styles.heroTexto}>
              Somos una organización civil mexicana, sin fines de lucro, formada por jóvenes
              que ponen sus estudios al servicio de proyectos reales con impacto social —
              desde Huamantla, Tlaxcala, hacia siete estados del país.
            </p>
            <div style={styles.heroBotones}>
              <Link to="/dashboard" className="sg-button-primary" style={styles.botonHero}>
                Sistema de voluntariado
              </Link>
              <Link to="/inventario" className="sg-button-secondary" style={{ ...styles.botonHero, borderColor: 'white', color: 'white' }}>
                Inventario
              </Link>
            </div>
            <p style={styles.heroNotaAcceso}>Ambos son de uso interno del equipo — inicia sesión para entrar.</p>
          </div>
        </div>
      </section>

      <section style={styles.cifras}>
        <Cifra numero="13" etiqueta="años de trabajo" detalle="fundada el 7 de enero de 2013" />
        <Cifra numero="112" etiqueta="voluntarios activos" />
        <Cifra numero="7" etiqueta="estados con presencia" />
        <Cifra numero="19" etiqueta="áreas de labor" />
      </section>

      <section id="quienes-somos" style={styles.seccion}>
        <div style={styles.articulo}>
          <h2 style={styles.tituloSeccion}>Quiénes somos</h2>
          <p style={styles.parrafo}>
            La Asociación Juvenil "Sueños de Comedia" está integrada por jóvenes comprometidos
            que buscan incidir de manera positiva en sus entornos. Funciona como una plataforma
            de aprendizaje, innovación y desarrollo de habilidades cívicas y profesionales,
            operando de forma altruista y sin fines de lucro para jóvenes de entre 15 y 28 años.
          </p>

          <div style={styles.mvGrid}>
            <div style={styles.mvTarjeta}>
              <h3 style={styles.mvTitulo}>Misión</h3>
              <p style={styles.mvTexto}>
                Fomentar el bienestar comunitario y el desarrollo integral de las juventudes,
                impulsando su participación mediante el arte, la cultura, el deporte, la labor
                social, la ciencia, la tecnología, la educación y la salud — para que sean agentes
                de cambio positivo en su comunidad.
              </p>
            </div>
            <div style={styles.mvTarjeta}>
              <h3 style={styles.mvTitulo}>Visión</h3>
              <p style={styles.mvTexto}>
                Ser una asociación juvenil reconocida por su capacidad de unir, inspirar y
                empoderar a la juventud, promoviendo valores y principios sociales para
                contribuir al desarrollo de una comunidad más justa y solidaria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...styles.seccion, background: 'var(--sg-surface)' }}>
        <div style={styles.articulo}>
          <h2 style={styles.tituloSeccion}>Áreas de labor</h2>
          <p style={styles.parrafo}>
            Casi veinte frentes distintos, todos con el mismo lema: participación e iniciativa
            juvenil al servicio de la sociedad.
          </p>
          <ul style={styles.listaAreas}>
            {AREAS_DE_LABOR.map((area) => (
              <li key={area} style={styles.pildoraArea}>{area}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="actividades" style={styles.seccion}>
        <div style={styles.articulo}>
          <h2 style={styles.tituloSeccion}>Próximas actividades</h2>
          <ActividadesPublicas actividades={actividades} error={errorActividades} />
        </div>
      </section>

      <section id="galeria" style={{ ...styles.seccion, background: 'var(--sg-surface)' }}>
        <div style={styles.articulo}>
          <h2 style={styles.tituloSeccion}>Galería</h2>
          <div style={styles.galeriaVacia}>
            <div style={styles.globoDecorativo} aria-hidden="true" />
            <p style={styles.galeriaTexto}>
              Estamos preparando fotos de nuestras actividades para esta sección.
              Vuelve pronto.
            </p>
          </div>
        </div>
      </section>

      <section id="contacto" style={styles.contacto}>
        <div style={styles.articulo}>
          <h2 style={{ ...styles.tituloSeccion, color: 'white' }}>Contacto</h2>
          <div style={styles.contactoGrid}>
            <div>
              <p style={styles.contactoTexto}>
                Domicilio fiscal y sede de talleres en Huamantla, Tlaxcala, con actividades
                presenciales también en Puebla capital, Bosques de San Sebastián y San Miguel
                Contla, además de programas nacionales en modalidad virtual.
              </p>
              <p style={styles.contactoSubtitulo}>Presencia en:</p>
              <p style={styles.contactoTexto}>{ESTADOS_CON_PRESENCIA.join(' · ')}</p>
            </div>
            <ul style={styles.contactoLista}>
              <li>
                <a href="https://wa.me/522471397394" style={styles.contactoEnlace} target="_blank" rel="noreferrer">
                  WhatsApp — 247 139 7394
                </a>
              </li>
              <li>
                <a href="https://wa.me/522213897963" style={styles.contactoEnlace} target="_blank" rel="noreferrer">
                  WhatsApp — 221 389 7963
                </a>
              </li>
              <li>
                <a href="mailto:suenoscomedia@gmail.com" style={styles.contactoEnlace}>
                  suenoscomedia@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/p/Asociaci%C3%B3n-Juvenil-Sue%C3%B1os-De-Comedia-100065194922296/"
                  style={styles.contactoEnlace}
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/asoc_juvenil_suenos_de_comedia/"
                  style={styles.contactoEnlace}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer style={styles.pie}>
        <span>© {new Date().getFullYear()} Asociación Juvenil Sueños de Comedia, A.C.</span>
        <Link to="/login" style={styles.pieEnlace}>Acceso al sistema</Link>
      </footer>
    </div>
  );
}

function EncabezadoPublico() {
  return (
    <header style={styles.encabezado}>
      <span style={styles.marca}>
        <img src="/logo-sigevac.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        Sueños de Comedia
      </span>
      <nav style={styles.navPublica}>
        <a href="#quienes-somos" style={styles.navEnlace}>Quiénes somos</a>
        <a href="#actividades" style={styles.navEnlace}>Actividades</a>
        <a href="#contacto" style={styles.navEnlace}>Contacto</a>
        <Link to="/login" className="sg-button-primary" style={{ width: 'auto', padding: '9px 18px' }}>
          Iniciar sesión
        </Link>
      </nav>
    </header>
  );
}

function Cifra({ numero, etiqueta, detalle }) {
  return (
    <div style={styles.cifra}>
      <span style={styles.cifraNumero}>{numero}</span>
      <span style={styles.cifraEtiqueta}>{etiqueta}</span>
      {detalle && <span style={styles.cifraDetalle}>{detalle}</span>}
    </div>
  );
}

function ActividadesPublicas({ actividades, error }) {
  if (error) {
    return <p style={styles.parrafo}>No pudimos cargar las próximas actividades en este momento.</p>;
  }
  if (actividades === null) {
    return <p style={{ color: 'var(--sg-ink-soft)' }}>Cargando actividades…</p>;
  }
  if (actividades.length === 0) {
    return <p style={styles.parrafo}>Aún no hay actividades públicas programadas. Vuelve pronto.</p>;
  }
  return (
    <ul style={styles.listaActividades}>
      {actividades.map((a) => {
        const fecha = formatearFecha(a.fecha);
        return (
          <li key={a.id} style={styles.filaActividad}>
            <div style={styles.fechaBloque}>
              <span style={styles.fechaDia}>{fecha.dia}</span>
              <span style={styles.fechaMes}>{fecha.mes}</span>
            </div>
            <div>
              <p style={styles.actividadNombre}>{a.nombre}</p>
              {a.lugar && <p style={styles.actividadLugar}>{a.lugar}</p>}
              {a.descripcion && <p style={styles.actividadDescripcion}>{a.descripcion}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const styles = {
  pagina: { background: 'var(--sg-bg)' },
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 32px', background: 'var(--sg-surface)', borderBottom: '1px solid var(--sg-border)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  marca: {
    display: 'flex', alignItems: 'center', gap: 10,
    fontFamily: 'var(--sg-font-display)', fontSize: 19, fontWeight: 600, color: 'var(--sg-primary-dark)',
  },
  navPublica: { display: 'flex', alignItems: 'center', gap: 24 },
  navEnlace: { color: 'var(--sg-ink-soft)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },

  hero: {
    background: 'linear-gradient(155deg, var(--sg-ink) 0%, var(--sg-primary-dark) 55%, var(--sg-primary) 100%)',
    padding: '64px 32px',
  },
  heroContenido: {
    maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: '220px 1fr',
    gap: 48, alignItems: 'center',
  },
  heroLogo: { width: '100%', height: 'auto', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.35))' },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: 15, margin: 0 },
  heroTitulo: { fontFamily: 'var(--sg-font-display)', color: 'white', fontSize: 48, margin: '4px 0 14px', lineHeight: 1.05 },
  heroLema: {
    fontFamily: 'var(--sg-font-display)', color: 'var(--sg-accent)', fontSize: 21,
    fontStyle: 'normal', margin: '0 0 16px', maxWidth: 560,
  },
  heroTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 1.6, maxWidth: 560, margin: '0 0 26px' },
  heroBotones: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  botonHero: { width: 'auto', padding: '13px 24px' },
  heroNotaAcceso: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 12 },

  cifras: {
    maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8, padding: '40px 32px', textAlign: 'center',
  },
  cifra: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', borderLeft: '1px solid var(--sg-border)' },
  cifraNumero: { fontFamily: 'var(--sg-font-display)', fontSize: 40, color: 'var(--sg-primary-dark)', fontWeight: 600 },
  cifraEtiqueta: { fontSize: 14, color: 'var(--sg-ink-soft)', fontWeight: 600 },
  cifraDetalle: { fontSize: 12, color: 'var(--sg-ink-soft)', opacity: 0.8 },

  seccion: { padding: '56px 32px' },
  articulo: { maxWidth: 780, margin: '0 auto' },
  tituloSeccion: { fontSize: 30, marginBottom: 18 },
  parrafo: { fontSize: 16, lineHeight: 1.7, color: 'var(--sg-ink-soft)', maxWidth: '68ch' },

  mvGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 },
  mvTarjeta: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)', padding: 24,
  },
  mvTitulo: { fontSize: 18, color: 'var(--sg-primary-dark)', marginBottom: 10 },
  mvTexto: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--sg-ink-soft)', margin: 0 },

  listaAreas: { display: 'flex', flexWrap: 'wrap', gap: 10, padding: 0, marginTop: 24, listStyle: 'none' },
  pildoraArea: {
    padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
    background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary-dark)', border: '1px solid var(--sg-border)',
  },

  listaActividades: { listStyle: 'none', padding: 0, marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  filaActividad: {
    display: 'grid', gridTemplateColumns: '64px 1fr', gap: 18, alignItems: 'flex-start',
    padding: 16, background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 12,
  },
  fechaBloque: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'var(--sg-bg)', borderRadius: 10, padding: '8px 0', color: 'var(--sg-primary-dark)',
  },
  fechaDia: { fontFamily: 'var(--sg-font-display)', fontSize: 22, fontWeight: 600, lineHeight: 1 },
  fechaMes: { fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  actividadNombre: { fontWeight: 600, margin: '0 0 4px' },
  actividadLugar: { fontSize: 13.5, color: 'var(--sg-ink-soft)', margin: '0 0 4px' },
  actividadDescripcion: { fontSize: 13.5, color: 'var(--sg-ink-soft)', margin: 0, lineHeight: 1.5 },

  galeriaVacia: {
    marginTop: 20, padding: '40px 24px', textAlign: 'center', borderRadius: 'var(--sg-radius)',
    border: '1.5px dashed var(--sg-border)',
  },
  globoDecorativo: {
    width: 46, height: 46, margin: '0 auto 14px', borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--sg-accent), var(--sg-primary))',
  },
  galeriaTexto: { color: 'var(--sg-ink-soft)', fontSize: 14.5, margin: 0 },

  contacto: { background: 'var(--sg-ink)', padding: '56px 32px' },
  contactoGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, marginTop: 8 },
  contactoTexto: { color: 'rgba(255,255,255,0.78)', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 12px' },
  contactoSubtitulo: { color: 'white', fontSize: 13, fontWeight: 700, margin: '18px 0 6px' },
  contactoLista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  contactoEnlace: { color: 'white', fontSize: 15, fontWeight: 600, textDecoration: 'none', opacity: 0.92 },

  pie: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    padding: '20px 32px', background: 'var(--sg-ink)', borderTop: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
  },
  pieEnlace: { color: 'rgba(255,255,255,0.85)', fontWeight: 600, textDecoration: 'none' },
};
