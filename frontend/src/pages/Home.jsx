import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  IconoWhatsApp, IconoInstagram, IconoFacebook, IconoCorreo, IconoMision, IconoVision,
} from '../components/IconosPublicos.jsx';

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

// Respaldo de la sección "Galería": se muestra mientras responde
// /publico/galeria, y también si la llamada falla, para que la sección
// nunca se vea vacía. Antes esto era la ÚNICA fuente (arreglo fijo en el
// código); ahora la Administración puede subir/editar/quitar fotos desde
// el panel (módulo de galería) y el Home las trae de ahí.
const GALERIA_RESPALDO = [
  {
    src: '/galeria/danza-folklorica-kiosco.jpg',
    alt: 'Grupo de danza folklórica de la asociación bailando frente a un kiosco, con vestuario tradicional blanco y detalles rojos',
    caption: 'Danza folklórica en la plaza',
  },
  {
    src: '/galeria/danza-folklorica-patio-blanco.jpg',
    alt: 'Bailarines con trajes blancos y sombreros presentándose en el patio de un edificio histórico de cantera',
    caption: 'Presentación en recinto histórico',
  },
  {
    src: '/galeria/danza-folklorica-patio-rojo.jpg',
    alt: 'Bailarinas con faldas rojas y amarillas bailando en el patio de un edificio colonial',
    caption: 'Danza folklórica — faldas rojas',
  },
  {
    src: '/galeria/taller-reposteria.jpg',
    alt: 'Voluntarios preparando repostería en un taller comunitario',
    caption: 'Taller de repostería',
  },
  {
    src: '/galeria/evento-sentimientos-cubicos.jpg',
    alt: 'Grupo de danza de la asociación en un escenario, en el décimo aniversario de Sentimientos Cúbicos México',
    caption: '10.º aniversario Sentimientos Cúbicos México',
  },
  {
    src: '/galeria/flyer-voluntariado-verano-2026.jpg',
    alt: 'Cartel del Programa de Voluntariado de Verano 2026, del 25 de julio al 23 de agosto',
    caption: 'Voluntariado de Verano 2026',
  },
  {
    src: '/galeria/flyer-convocatoria-nacional-2026.jpg',
    alt: 'Cartel de la Convocatoria Nacional para Líderes Estatales 2026',
    caption: 'Convocatoria de Líderes Estatales',
  },
  {
    src: '/galeria/flyer-areas-labor.jpg',
    alt: 'Infografía con las áreas de labor de la asociación y sus datos de contacto',
    caption: 'Nuestras áreas de labor',
  },
];

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return { dia: Number(dia), mes: MESES[Number(mes) - 1], anio };
}

const SECCIONES_MENU = ['quienes-somos', 'actividades', 'galeria', 'contacto'];

/**
 * Resalta en el menú la sección visible mientras el usuario hace scroll,
 * usando IntersectionObserver (más barato que escuchar el evento "scroll").
 * Considera "activa" la sección cuya franja central de la ventana ocupa.
 */
function useSeccionActiva(ids) {
  const [activa, setActiva] = useState(null);

  useEffect(() => {
    // jsdom (entorno de test) y navegadores muy antiguos no implementan
    // IntersectionObserver: en ese caso simplemente no hay resaltado,
    // en vez de romper el resto de la página.
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const elementos = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (elementos.length === 0) return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas.filter((e) => e.isIntersecting);
        if (visibles.length > 0) {
          setActiva(visibles[0].target.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [ids]);

  return activa;
}

// Valores de respaldo: se muestran mientras responde /publico/estadisticas,
// y también si la llamada falla, para que la sección nunca se vea vacía.
const CIFRAS_RESPALDO = { anios_trabajo: 13, voluntarios_activos: 112, estados_con_presencia: 7, areas_de_labor: 19 };

export default function Home() {
  const [actividades, setActividades] = useState(null);
  const [errorActividades, setErrorActividades] = useState(false);
  const [cifras, setCifras] = useState(CIFRAS_RESPALDO);
  const [galeria, setGaleria] = useState(GALERIA_RESPALDO);
  const seccionActiva = useSeccionActiva(SECCIONES_MENU);

  useEffect(() => {
    api.get('/publico/actividades')
      .then(({ data }) => setActividades(data.actividades))
      .catch(() => setErrorActividades(true));
  }, []);

  useEffect(() => {
    api.get('/publico/estadisticas')
      .then(({ data }) => setCifras((actual) => ({ ...actual, ...data })))
      .catch(() => {}); // se quedan las cifras de respaldo, sin mostrar error
  }, []);

  useEffect(() => {
    api.get('/publico/galeria')
      .then(({ data }) => { if (data.fotos?.length > 0) setGaleria(data.fotos); })
      .catch(() => {}); // se queda la galería de respaldo, sin mostrar error
  }, []);

  const quitarFotoRota = (idOSrc) => {
    setGaleria((actual) => {
      const restantes = actual.filter((f) => (f.id || f.src) !== idOSrc);
      // Si ya no queda ninguna foto real (todas fallaron al cargar),
      // se vuelve al respaldo local en vez de dejar la sección vacía.
      return restantes.length > 0 ? restantes : GALERIA_RESPALDO;
    });
  };

  return (
    <div style={styles.pagina}>
      <EncabezadoPublico seccionActiva={seccionActiva} />

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
        <Cifra numero={cifras.anios_trabajo} etiqueta="años de trabajo" detalle="fundada el 7 de enero de 2013" />
        <Cifra numero={cifras.voluntarios_activos} etiqueta="voluntarios activos" />
        <Cifra numero={cifras.estados_con_presencia} etiqueta="estados con presencia" />
        <Cifra numero={cifras.areas_de_labor} etiqueta="áreas de labor" />
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
            <div className="sg-mv-card" style={styles.mvTarjeta}>
              <div style={styles.mvIcono}><IconoMision /></div>
              <h3 style={styles.mvTitulo}>Misión</h3>
              <p style={styles.mvTexto}>
                Fomentar el bienestar comunitario y el desarrollo integral de las juventudes,
                impulsando su participación mediante el arte, la cultura, el deporte, la labor
                social, la ciencia, la tecnología, la educación y la salud — para que sean agentes
                de cambio positivo en su comunidad.
              </p>
            </div>
            <div className="sg-mv-card" style={styles.mvTarjeta}>
              <div style={styles.mvIcono}><IconoVision /></div>
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
              <li key={area} className="sg-area-pill" style={styles.pildoraArea}>{area}</li>
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
        <div style={styles.articuloAncho}>
          <h2 style={styles.tituloSeccion}>Galería</h2>
          <p style={styles.parrafo}>
            Momentos de nuestros talleres, presentaciones y convocatorias recientes.
          </p>
          <GaleriaFotos fotos={galeria} onFotoRota={quitarFotoRota} />
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
                <a href="https://wa.me/522471397394" className="sg-contact-link" style={styles.contactoEnlace} target="_blank" rel="noreferrer">
                  <span className="sg-contact-icon" style={styles.contactoIcono}><IconoWhatsApp /></span>
                  WhatsApp — 247 139 7394
                </a>
              </li>
              <li>
                <a href="https://wa.me/522213897963" className="sg-contact-link" style={styles.contactoEnlace} target="_blank" rel="noreferrer">
                  <span className="sg-contact-icon" style={styles.contactoIcono}><IconoWhatsApp /></span>
                  WhatsApp — 221 389 7963
                </a>
              </li>
              <li>
                <a href="mailto:suenoscomedia@gmail.com" className="sg-contact-link" style={styles.contactoEnlace}>
                  <span className="sg-contact-icon" style={styles.contactoIcono}><IconoCorreo /></span>
                  suenoscomedia@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/p/Asociaci%C3%B3n-Juvenil-Sue%C3%B1os-De-Comedia-100065194922296/"
                  className="sg-contact-link"
                  style={styles.contactoEnlace}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="sg-contact-icon" style={styles.contactoIcono}><IconoFacebook /></span>
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/asoc_juvenil_suenos_de_comedia/"
                  className="sg-contact-link"
                  style={styles.contactoEnlace}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="sg-contact-icon" style={styles.contactoIcono}><IconoInstagram /></span>
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer style={styles.pie}>
        <span>© {new Date().getFullYear()} Asociación Juvenil Sueños de Comedia, A.C.</span>
        <div style={styles.pieIconos}>
          <a href="https://wa.me/522471397394" className="sg-footer-icon" style={styles.pieIcono} target="_blank" rel="noreferrer" aria-label="WhatsApp">
            <IconoWhatsApp width={18} height={18} />
          </a>
          <a href="https://www.instagram.com/asoc_juvenil_suenos_de_comedia/" className="sg-footer-icon" style={styles.pieIcono} target="_blank" rel="noreferrer" aria-label="Instagram">
            <IconoInstagram width={18} height={18} />
          </a>
          <a
            href="https://www.facebook.com/p/Asociaci%C3%B3n-Juvenil-Sue%C3%B1os-De-Comedia-100065194922296/"
            className="sg-footer-icon" style={styles.pieIcono} target="_blank" rel="noreferrer" aria-label="Facebook"
          >
            <IconoFacebook width={18} height={18} />
          </a>
          <a href="mailto:suenoscomedia@gmail.com" className="sg-footer-icon" style={styles.pieIcono} aria-label="Correo">
            <IconoCorreo width={18} height={18} />
          </a>
        </div>
        <Link to="/login" style={styles.pieEnlace}>Acceso al sistema</Link>
      </footer>
    </div>
  );
}

function EncabezadoPublico({ seccionActiva }) {
  const enlaceEstilo = (id) => ({
    ...styles.navEnlace,
    ...(seccionActiva === id ? styles.navEnlaceActivo : {}),
  });

  return (
    <header style={styles.encabezado}>
      <span style={styles.marca}>
        <img src="/logo-sigevac.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        Sueños de Comedia
      </span>
      <nav style={styles.navPublica}>
        <a href="#quienes-somos" style={enlaceEstilo('quienes-somos')}>Quiénes somos</a>
        <a href="#actividades" style={enlaceEstilo('actividades')}>Actividades</a>
        <a href="#contacto" style={enlaceEstilo('contacto')}>Contacto</a>
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
          <li key={a.id} className="sg-activity-item" style={styles.filaActividad}>
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

// Las fotos de respaldo (GALERIA_RESPALDO) son archivos estáticos del
// propio frontend (/public/galeria/...) y su ruta ya es correcta tal
// cual. Las que vienen del backend (/publico/galeria/:id/imagen) son
// rutas relativas a la API, así que hay que anteponerles su baseURL
// (que puede vivir en otro host/puerto en desarrollo, o en el mismo
// dominio detrás de un reverse proxy en producción).
function urlCompletaFoto(src) {
  return src.startsWith('/publico/') ? `${api.defaults.baseURL}${src}` : src;
}

// Si una foto de la galería (las que vienen del backend) ya no se puede
// cargar — por ejemplo, el registro sigue en la base de datos pero el
// archivo se perdió en el almacenamiento (ver DEPLOY.md, sección
// "Almacenamiento de archivos") — no tiene sentido mostrar un ícono de
// imagen rota en una página pública. Se quita esa foto de la vista en
// cuanto el navegador reporta el error de carga; si terminan quitándose
// todas, se vuelve a la galería de respaldo para que la sección nunca
// se vea vacía ni rota.
function GaleriaFotos({ fotos, onFotoRota }) {
  return (
    <div style={styles.galeriaGrid}>
      {fotos.map((foto) => {
        const src = urlCompletaFoto(foto.src);
        return (
          <a
            key={foto.id || foto.src}
            href={src}
            target="_blank"
            rel="noreferrer"
            className="sg-galeria-item"
            style={styles.galeriaItem}
            aria-label={`Ver en tamaño completo: ${foto.caption}`}
          >
            <img
              src={src}
              alt={foto.alt}
              loading="lazy"
              style={styles.galeriaImg}
              onError={() => onFotoRota?.(foto.id || foto.src)}
            />
            <span style={styles.galeriaCaption}>{foto.caption}</span>
          </a>
        );
      })}
    </div>
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
  navEnlace: {
    color: 'var(--sg-ink-soft)', fontWeight: 600, fontSize: 14, textDecoration: 'none',
    paddingBottom: 3, borderBottom: '2px solid transparent', transition: 'color 0.15s, border-color 0.15s',
  },
  navEnlaceActivo: { color: 'var(--sg-primary-dark)', borderBottomColor: 'var(--sg-primary)' },

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
  // La galería usa un contenedor más ancho que el resto de las secciones
  // (que están pensadas para texto de lectura) para que las fotos tengan
  // espacio y el grid se vea bien en 3-4 columnas.
  articuloAncho: { maxWidth: 1080, margin: '0 auto' },
  tituloSeccion: { fontSize: 30, marginBottom: 18 },
  parrafo: { fontSize: 16, lineHeight: 1.7, color: 'var(--sg-ink-soft)', maxWidth: '68ch' },

  mvGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 },
  mvTarjeta: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)', padding: '32px 28px', cursor: 'default',
  },
  mvIcono: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46,
    borderRadius: 12, background: 'rgba(54, 169, 214, 0.12)', color: 'var(--sg-primary-dark)', marginBottom: 16,
  },
  mvTitulo: { fontSize: 18, color: 'var(--sg-primary-dark)', marginBottom: 10 },
  mvTexto: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--sg-ink-soft)', margin: 0 },

  listaAreas: { display: 'flex', flexWrap: 'wrap', gap: 10, padding: 0, marginTop: 24, listStyle: 'none' },
  pildoraArea: {
    padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
    background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary-dark)', border: '1px solid var(--sg-border)',
    cursor: 'default',
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

  galeriaGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, marginTop: 24,
  },
  galeriaItem: {
    display: 'block', borderRadius: 'var(--sg-radius)', overflow: 'hidden', textDecoration: 'none',
    background: 'var(--sg-bg)', border: '1px solid var(--sg-border)',
  },
  galeriaImg: { width: '100%', height: 190, objectFit: 'cover', display: 'block' },
  galeriaCaption: {
    display: 'block', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--sg-ink-soft)',
  },

  contacto: { background: 'var(--sg-ink)', padding: '56px 32px' },
  contactoGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, marginTop: 8 },
  contactoTexto: { color: 'rgba(255,255,255,0.78)', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 12px' },
  contactoSubtitulo: { color: 'white', fontSize: 13, fontWeight: 700, margin: '18px 0 6px' },
  contactoLista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  contactoEnlace: {
    display: 'flex', alignItems: 'center', gap: 12, color: 'white', fontSize: 15,
    fontWeight: 600, textDecoration: 'none', opacity: 0.92,
  },
  contactoIcono: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: 'white',
  },

  pie: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
    padding: '20px 32px', background: 'var(--sg-ink)', borderTop: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
  },
  pieIconos: { display: 'flex', alignItems: 'center', gap: 16 },
  pieIcono: { color: 'rgba(255,255,255,0.65)', display: 'flex' },
  pieEnlace: { color: 'rgba(255,255,255,0.85)', fontWeight: 600, textDecoration: 'none' },
};
