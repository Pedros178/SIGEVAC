import React, { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import FotoAutenticada from '../components/FotoAutenticada.jsx';
import TarjetaIndicador from '../components/TarjetaIndicador.jsx';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

const ESTADOS_FISICOS = [
  { valor: 'bueno', etiqueta: 'Bueno' },
  { valor: 'regular', etiqueta: 'Regular' },
  { valor: 'dañado', etiqueta: 'Dañado' },
  { valor: 'baja', etiqueta: 'De baja' },
];

const BADGE_ESTADO = { bueno: 'sg-badge-success', regular: 'sg-badge-warning', dañado: 'sg-badge-danger', baja: 'sg-badge-danger' };
const UNIDADES_INVENTARIO = ['pieza', 'juego', 'caja', 'paquete', 'bolsa', 'litro', 'kilogramo', 'metro'];

/**
 * Inventario (Fase 8, ampliado): artículos organizados por área/categoría
 * y subcategoría (p.ej. Vestuario > Sombreros, Arte y Cultura >
 * Escenografía), con fotos, código QR/SKU, estado físico, movimientos
 * simples de entrada/salida, préstamos formales (para vestuario o
 * escenografía que sale a un evento) e historial de mantenimiento.
 */
export default function Inventario() {
  const { tieneAlgunPermiso } = useAuth();
  const puedeGestionar = tieneAlgunPermiso(['inventario.gestionar']);

  const [vista, setVista] = useState('articulos'); // 'articulos' | 'prestamos'
  const [categorias, setCategorias] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [escaneandoQr, setEscaneandoQr] = useState(false);
  const videoQrRef = React.useRef(null);
  const flujoQrRef = React.useRef(null);

  const [filtroCategoriaId, setFiltroCategoriaId] = useState('');
  const [filtroSubcategoriaId, setFiltroSubcategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [articuloSeleccionadoId, setArticuloSeleccionadoId] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const [mostrarFormArticulo, setMostrarFormArticulo] = useState(false);
  const [mostrarFormCategoria, setMostrarFormCategoria] = useState(false);
  const [mostrarFormPrestamo, setMostrarFormPrestamo] = useState(false);

  async function cargarCategorias() {
    try {
      const { data } = await api.get('/inventario/categorias');
      setCategorias(data.categorias);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las categorías.');
    }
  }

  async function cargarArticulos() {
    setCargando(true);
    try {
      const params = {};
      if (filtroCategoriaId) params.categoria_id = filtroCategoriaId;
      if (filtroSubcategoriaId) params.subcategoria_id = filtroSubcategoriaId;
      if (busqueda) params.q = busqueda;
      const { data } = await api.get('/inventario', { params });
      setArticulos(data.articulos);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el inventario.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarPrestamos() {
    try {
      const { data } = await api.get('/inventario/prestamos');
      setPrestamos(data.prestamos);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los préstamos.');
    }
  }

  async function abrirDetalle(id) {
    setArticuloSeleccionadoId(id);
    try {
      const { data } = await api.get(`/inventario/${id}`);
      setDetalle(data.articulo);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el artículo.');
    }
  }

  function cerrarDetalle() {
    setArticuloSeleccionadoId(null);
    setDetalle(null);
  }

  function detenerEscanerQr() {
    flujoQrRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoQrRef.current = null;
    setEscaneandoQr(false);
  }

  async function abrirEscanerQr() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('El navegador no permite usar la cámara. Puedes buscar el artículo por nombre.');
      return;
    }
    try {
      flujoQrRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setEscaneandoQr(true);
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'El acceso a la cámara fue bloqueado. Permítelo desde el candado del navegador.'
        : 'No se pudo abrir la cámara. Verifica que esté conectada y que no la use otra aplicación.');
    }
  }

  useEffect(() => () => detenerEscanerQr(), []);
  useEffect(() => {
    if (!escaneandoQr || !videoQrRef.current || !flujoQrRef.current) return undefined;
    const video = videoQrRef.current;
    video.srcObject = flujoQrRef.current;
    const canvas = document.createElement('canvas');
    const contexto = canvas.getContext('2d', { willReadFrequently: true });
    let activo = true;
    const revisar = async () => {
      if (!activo || !video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      const resultado = jsQR(contexto.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (resultado?.data) {
        detenerEscanerQr();
        try {
          const { data } = await api.get(`/inventario/qr/${encodeURIComponent(resultado.data)}`);
          setArticuloSeleccionadoId(data.articulo.id);
          setDetalle(data.articulo);
        } catch (err) {
          setError(err.response?.data?.error || 'No se encontró ningún artículo con ese código QR.');
        }
        return;
      }
      if (activo) window.requestAnimationFrame(revisar);
    };
    const iniciar = () => window.requestAnimationFrame(revisar);
    video.addEventListener('playing', iniciar, { once: true });
    return () => {
      activo = false;
      video.removeEventListener('playing', iniciar);
    };
  }, [escaneandoQr]);

  useEffect(() => { cargarCategorias(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarArticulos(); }, [filtroCategoriaId, filtroSubcategoriaId, busqueda]);
  useEffect(() => { if (vista === 'prestamos') cargarPrestamos(); }, [vista]);

  async function recargarTodo() {
    await Promise.all([cargarArticulos(), cargarCategorias()]);
    if (articuloSeleccionadoId) await abrirDetalle(articuloSeleccionadoId);
  }

  return (
    <div>
      <BarraNavegacion />
      <main style={styles.contenedor}>
        <div style={styles.encabezado}>
          <div>
            <h1 style={styles.titulo}>Inventario</h1>
            <p style={styles.subtitulo}>Vestuario, escenografía, utilería y demás artículos de la asociación.</p>
          </div>
          <div style={styles.tabs}>
            <button
              className={vista === 'articulos' ? 'sg-button-primary' : 'sg-button-secondary'}
              style={{ width: 'auto' }}
              onClick={() => setVista('articulos')}
            >
              Artículos
            </button>
            <button
              className={vista === 'prestamos' ? 'sg-button-primary' : 'sg-button-secondary'}
              style={{ width: 'auto' }}
              onClick={() => setVista('prestamos')}
            >
              Préstamos
            </button>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {vista === 'articulos' ? (
          <section className="sg-stat-grid" aria-label="Indicadores de artículos">
            <TarjetaIndicador icono="📦" tema="azul" valor={articulos.length} etiqueta="Artículos en esta vista" nota={`${categorias.length} categorías`} />
            <TarjetaIndicador icono="🔄" tema="cian" valor={articulos.filter((a) => a.es_prestable).length} etiqueta="Prestables" nota="Vestuario, equipo, escenografía" />
            <TarjetaIndicador icono="⚠️" tema="ambar" valor={articulos.filter((a) => a.existencias <= a.minimo).length} etiqueta="Bajo mínimo" nota="Requieren reabastecer" />
            <TarjetaIndicador icono="🔧" tema="rojo" valor={articulos.filter((a) => a.estado_fisico === 'dañado' || a.estado_fisico === 'baja').length} etiqueta="Dañados / de baja" nota="Revisar estado físico" />
          </section>
        ) : (
          <section className="sg-stat-grid" aria-label="Indicadores de préstamos">
            <TarjetaIndicador icono="🔄" tema="azul" valor={prestamos.length} etiqueta="Total registros" />
            <TarjetaIndicador icono="📤" tema="ambar" valor={prestamos.filter((p) => p.estado === 'prestado').length} etiqueta="En préstamo" />
            <TarjetaIndicador icono="✅" tema="verde" valor={prestamos.filter((p) => p.estado === 'devuelto').length} etiqueta="Devueltos" />
            <TarjetaIndicador icono="⚠️" tema="rojo" valor={prestamos.filter((p) => p.atrasado).length} etiqueta="Vencidos" />
          </section>
        )}

        {vista === 'articulos' ? (
          <div style={styles.layout}>
            <aside style={styles.sidebar}>
              <h3 style={styles.sidebarTitulo}>Áreas</h3>
              <button
                style={{ ...styles.categoriaBtn, ...(!filtroCategoriaId ? styles.categoriaBtnActivo : {}) }}
                onClick={() => { setFiltroCategoriaId(''); setFiltroSubcategoriaId(''); }}
              >
                Todas
              </button>
              {categorias.map((cat) => (
                <div key={cat.id}>
                  <button
                    style={{ ...styles.categoriaBtn, ...(filtroCategoriaId === cat.id ? styles.categoriaBtnActivo : {}) }}
                    onClick={() => { setFiltroCategoriaId(cat.id); setFiltroSubcategoriaId(''); }}
                  >
                    {cat.nombre}
                  </button>
                  {filtroCategoriaId === cat.id && cat.subcategorias?.length > 0 && (
                    <div style={styles.subcategorias}>
                      {cat.subcategorias.map((sub) => (
                        <button
                          key={sub.id}
                          style={{ ...styles.subcategoriaBtn, ...(filtroSubcategoriaId === sub.id ? styles.categoriaBtnActivo : {}) }}
                          onClick={() => setFiltroSubcategoriaId(filtroSubcategoriaId === sub.id ? '' : sub.id)}
                        >
                          {sub.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {puedeGestionar && (
                <button className="sg-button-secondary" style={{ marginTop: 12 }} onClick={() => setMostrarFormCategoria((v) => !v)}>
                  {mostrarFormCategoria ? 'Cancelar' : '+ Nueva categoría'}
                </button>
              )}
              {mostrarFormCategoria && (
                <FormCategoria
                  categorias={categorias}
                  onCreada={async () => { setMostrarFormCategoria(false); await cargarCategorias(); }}
                  onError={setError}
                />
              )}
            </aside>

            <section style={styles.principal}>
              <div style={styles.barraAcciones}>
                <input
                  className="sg-input"
                  placeholder="Buscar artículo…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
                <button className="sg-button-secondary" style={{ width: 'auto' }} onClick={abrirEscanerQr}>
                  Escanear QR
                </button>
                {puedeGestionar && (
                  <button className="sg-button-primary" style={{ width: 'auto' }} onClick={() => setMostrarFormArticulo((v) => !v)}>
                    {mostrarFormArticulo ? 'Cancelar' : '+ Nuevo artículo'}
                  </button>
                )}
              </div>

              {escaneandoQr && (
                <div style={styles.visorQr}>
                  <video ref={videoQrRef} autoPlay playsInline muted style={styles.videoQr} />
                  <button type="button" className="sg-button-secondary" style={{ width: 'auto' }} onClick={detenerEscanerQr}>Cerrar cámara</button>
                </div>
              )}

              {mostrarFormArticulo && (
                <FormArticulo
                  categorias={categorias}
                  onCreado={async () => { setMostrarFormArticulo(false); await cargarArticulos(); }}
                  onError={setError}
                />
              )}

              {cargando ? (
                <p style={{ color: 'var(--sg-ink-soft)' }}>Cargando…</p>
              ) : articulos.length === 0 ? (
                <p style={{ color: 'var(--sg-ink-soft)' }}>No hay artículos en esta selección.</p>
              ) : (
                <div style={styles.grid}>
                  {articulos.map((a) => (
                    <button key={a.id} style={styles.tarjeta} onClick={() => abrirDetalle(a.id)}>
                      <div style={styles.tarjetaFoto}>
                        {a.foto_principal_id
                          ? <FotoAutenticada ruta={`/inventario/${a.id}/fotos/${a.foto_principal_id}`} style={styles.tarjetaImg} />
                          : <span style={{ fontSize: 28 }}>📦</span>}
                      </div>
                      <strong style={{ fontSize: 14 }}>{a.nombre}</strong>
                      <span style={{ fontSize: 12, color: 'var(--sg-ink-soft)' }}>
                        {[a.categoria_nombre, a.subcategoria_nombre].filter(Boolean).join(' · ') || 'Sin categoría'}
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`sg-badge ${a.existencias <= a.minimo ? 'sg-badge-warning' : 'sg-badge-success'}`}>
                          {a.existencias} {a.unidad}
                        </span>
                        <span className={`sg-badge ${BADGE_ESTADO[a.estado_fisico] || 'sg-badge-success'}`}>{a.estado_fisico}</span>
                        {a.es_prestable && <span className="sg-badge sg-badge-success">Prestable</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <VistaPrestamos
            prestamos={prestamos}
            articulos={articulos}
            puedeGestionar={puedeGestionar}
            mostrarForm={mostrarFormPrestamo}
            onToggleForm={() => setMostrarFormPrestamo((v) => !v)}
            onCambio={cargarPrestamos}
            onError={setError}
          />
        )}

        {articuloSeleccionadoId && detalle && (
          <DetalleArticulo
            articulo={detalle}
            puedeGestionar={puedeGestionar}
            onCerrar={cerrarDetalle}
            onCambio={recargarTodo}
            onError={setError}
          />
        )}
      </main>
    </div>
  );
}

function FormCategoria({ categorias, onCreada, onError }) {
  const [nombre, setNombre] = useState('');
  const [padreId, setPadreId] = useState('');

  async function crear(e) {
    e.preventDefault();
    try {
      await api.post('/inventario/categorias', { nombre, categoria_padre_id: padreId || undefined });
      setNombre('');
      setPadreId('');
      onCreada();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo crear la categoría.');
    }
  }

  return (
    <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      <input className="sg-input" placeholder="Nombre de la categoría o subcategoría" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <select className="sg-input" value={padreId} onChange={(e) => setPadreId(e.target.value)}>
        <option value="">— Es un área de primer nivel —</option>
        {categorias.map((c) => (<option key={c.id} value={c.id}>Subcategoría de: {c.nombre}</option>))}
      </select>
      <button className="sg-button-primary" style={{ width: 'auto' }}>Guardar</button>
    </form>
  );
}

function FormArticulo({ categorias, onCreado, onError }) {
  const [form, setForm] = useState({ nombre: '', unidad: 'pieza', minimo: 0, categoria_id: '', subcategoria_id: '', ubicacion: '', es_prestable: false });
  const categoriaSeleccionada = categorias.find((c) => c.id === form.categoria_id);

  async function crear(e) {
    e.preventDefault();
    try {
      await api.post('/inventario', {
        ...form,
        categoria_id: form.categoria_id || undefined,
        subcategoria_id: form.subcategoria_id || undefined,
      });
      onCreado();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo crear el artículo.');
    }
  }

  return (
    <form onSubmit={crear} style={styles.formArticulo}>
      <CampoArticulo etiqueta="Nombre del artículo" requerido><input className="sg-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></CampoArticulo>
      <CampoArticulo etiqueta="Categoría (área)"><select className="sg-input" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: '' })}><option value="">Selecciona un área</option>{categorias.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}</select></CampoArticulo>
      <CampoArticulo etiqueta="Subcategoría"><select className="sg-input" value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value })} disabled={!categoriaSeleccionada?.subcategorias?.length}><option value="">Sin subcategoría</option>{categoriaSeleccionada?.subcategorias?.map((s) => (<option key={s.id} value={s.id}>{s.nombre}</option>))}</select></CampoArticulo>
      <CampoArticulo etiqueta="Unidad"><select className="sg-input" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>{UNIDADES_INVENTARIO.map((unidad) => <option key={unidad} value={unidad}>{unidad}</option>)}</select></CampoArticulo>
      <CampoArticulo etiqueta="Mínimo deseado" ayuda="Alerta si las existencias bajan a este número"><input className="sg-input" type="number" min="0" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })} /></CampoArticulo>
      <CampoArticulo etiqueta="Ubicación" ayuda="bodega, estante..."><input className="sg-input" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></CampoArticulo>
      <label style={styles.opcionPrestable}><input type="checkbox" checked={form.es_prestable} onChange={(e) => setForm({ ...form, es_prestable: e.target.checked })} /> Se puede prestar</label>
      <button className="sg-button-primary" style={{ width: 'auto' }}>Agregar artículo</button>
    </form>
  );
}

function CampoArticulo({ etiqueta, ayuda, requerido, children }) {
  return <label style={styles.campoArticulo}>{etiqueta}{requerido && ' *'}{ayuda && <small>{ayuda}</small>}{children}</label>;
}

function DetalleArticulo({ articulo, puedeGestionar, onCerrar, onCambio, onError }) {
  const [mov, setMov] = useState({ tipo: 'entrada', cantidad: '' });
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mantenimiento, setMantenimiento] = useState({ tipo: '', descripcion: '', costo: '' });
  const [ubicacion, setUbicacion] = useState(articulo.ubicacion || '');
  const [estadoFisico, setEstadoFisico] = useState(articulo.estado_fisico);
  const [esPrestable, setEsPrestable] = useState(articulo.es_prestable);
  const [qrUrl, setQrUrl] = useState(null);

  useEffect(() => {
    let url;
    api.get(`/inventario/${articulo.id}/qr`, { responseType: 'blob' })
      .then((respuesta) => { url = URL.createObjectURL(respuesta.data); setQrUrl(url); })
      .catch(() => onError('No se pudo generar la imagen del código QR.'));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [articulo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function imprimirQr() {
    if (!qrUrl) return;
    const ventana = window.open('', '_blank', 'width=500,height=650');
    if (!ventana) {
      onError('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    ventana.document.write(`<!doctype html><html><head><title>QR - ${articulo.nombre}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px;color:#172b3a}img{width:320px;height:320px;image-rendering:pixelated}h1{font-size:22px;margin:0 0 8px}p{margin:6px 0;font-size:15px}</style></head><body><h1>${articulo.nombre}</h1><p>SKU: ${articulo.sku || '—'}</p><img src="${qrUrl}" alt="Código QR de ${articulo.nombre}"><p>${articulo.codigo_qr || ''}</p><script>window.onload=function(){window.print();}</script></body></html>`);
    ventana.document.close();
  }

  async function registrarMovimiento(e) {
    e.preventDefault();
    try {
      await api.post(`/inventario/${articulo.id}/movimientos`, { tipo: mov.tipo, cantidad: Number(mov.cantidad) });
      setMov({ tipo: 'entrada', cantidad: '' });
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo registrar el movimiento.');
    }
  }

  async function subirFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const datos = new FormData();
      datos.append('foto', archivo);
      await api.post(`/inventario/${articulo.id}/fotos`, datos, { headers: { 'Content-Type': 'multipart/form-data' } });
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendoFoto(false);
      e.target.value = '';
    }
  }

  async function eliminarFoto(fotoId) {
    try {
      await api.delete(`/inventario/${articulo.id}/fotos/${fotoId}`);
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo eliminar la foto.');
    }
  }

  async function guardarCambios() {
    try {
      await api.put(`/inventario/${articulo.id}`, { ubicacion, estado_fisico: estadoFisico, es_prestable: esPrestable });
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudieron guardar los cambios.');
    }
  }

  async function registrarMantenimiento(e) {
    e.preventDefault();
    try {
      await api.post(`/inventario/${articulo.id}/mantenimientos`, {
        ...mantenimiento,
        costo: mantenimiento.costo ? Number(mantenimiento.costo) : undefined,
      });
      setMantenimiento({ tipo: '', descripcion: '', costo: '' });
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo registrar el mantenimiento.');
    }
  }

  return (
    <div style={styles.overlay} onClick={onCerrar}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.panelEncabezado}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 2 }}>{articulo.nombre}</h2>
            <span style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>
              {[articulo.categoria_nombre, articulo.subcategoria_nombre].filter(Boolean).join(' · ') || 'Sin categoría'}
            </span>
          </div>
          <button className="sg-button-secondary" style={{ width: 'auto' }} onClick={onCerrar}>Cerrar</button>
        </div>

        <div style={styles.panelGrid}>
          <div>
            <h4 style={styles.panelSubtitulo}>Fotos</h4>
            <div style={styles.fotosGrid}>
              {(articulo.fotos || []).map((f) => (
                <div key={f.id} style={styles.fotoMini}>
                  <FotoAutenticada ruta={`/inventario/${articulo.id}/fotos/${f.id}`} style={styles.fotoMiniImg} />
                  {puedeGestionar && (
                    <button style={styles.fotoEliminar} onClick={() => eliminarFoto(f.id)} title="Eliminar foto">✕</button>
                  )}
                </div>
              ))}
              {puedeGestionar && (
                <label style={styles.subirFotoBtn}>
                  {subiendoFoto ? 'Subiendo…' : '+ Foto'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subirFoto} style={{ display: 'none' }} disabled={subiendoFoto} />
                </label>
              )}
            </div>

            <h4 style={styles.panelSubtitulo}>Identificación</h4>
            <p style={styles.dato}><strong>SKU:</strong> {articulo.sku || '—'}</p>
            <p style={styles.dato}><strong>Código QR:</strong> {articulo.codigo_qr || '—'}</p>
            {qrUrl && (
              <div style={styles.qrArticulo}>
                <img src={qrUrl} alt={`Código QR de ${articulo.nombre}`} style={styles.qrImagen} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={qrUrl} download={`qr-${articulo.sku || articulo.id}.png`} style={styles.botonSubir}>Descargar QR</a>
                  <button type="button" onClick={imprimirQr} style={styles.botonSubir}>Imprimir QR</button>
                </div>
              </div>
            )}

            <h4 style={styles.panelSubtitulo}>Estado y ubicación</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select className="sg-input" value={estadoFisico} onChange={(e) => setEstadoFisico(e.target.value)} disabled={!puedeGestionar}>
                {ESTADOS_FISICOS.map((o) => (<option key={o.valor} value={o.valor}>{o.etiqueta}</option>))}
              </select>
              <input className="sg-input" placeholder="Ubicación física" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} disabled={!puedeGestionar} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--sg-ink-soft)', marginBottom: 8 }}>
              <input type="checkbox" checked={esPrestable} onChange={(e) => setEsPrestable(e.target.checked)} disabled={!puedeGestionar} />
              Se puede prestar
            </label>
            {puedeGestionar && <button className="sg-button-secondary" style={{ width: 'auto' }} onClick={guardarCambios}>Guardar cambios</button>}
          </div>

          <div>
            <h4 style={styles.panelSubtitulo}>Existencias: {articulo.existencias} {articulo.unidad} (mínimo {articulo.minimo})</h4>
            {puedeGestionar && (
              <form onSubmit={registrarMovimiento} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <select className="sg-input" value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value })}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
                <input className="sg-input" type="number" min="1" placeholder="Cantidad" value={mov.cantidad} onChange={(e) => setMov({ ...mov, cantidad: e.target.value })} required />
                <button className="sg-button-primary" style={{ width: 'auto' }}>Aplicar</button>
              </form>
            )}

            <h4 style={styles.panelSubtitulo}>Últimos movimientos</h4>
            <ul style={styles.lista}>
              {(articulo.movimientos || []).length === 0 && <li style={styles.listaVacia}>Sin movimientos aún.</li>}
              {(articulo.movimientos || []).map((m) => (
                <li key={m.id} style={styles.listaItem}>
                  <span className={`sg-badge ${m.tipo === 'entrada' ? 'sg-badge-success' : 'sg-badge-warning'}`}>{m.tipo}</span>
                  {' '}{m.cantidad} · {new Date(m.creado_en).toLocaleDateString('es-MX')}
                </li>
              ))}
            </ul>

            <h4 style={styles.panelSubtitulo}>Mantenimiento</h4>
            {puedeGestionar && (
              <form onSubmit={registrarMantenimiento} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <input className="sg-input" placeholder="Tipo (ej. Reparación de costura)" value={mantenimiento.tipo} onChange={(e) => setMantenimiento({ ...mantenimiento, tipo: e.target.value })} required />
                <input className="sg-input" placeholder="Descripción" value={mantenimiento.descripcion} onChange={(e) => setMantenimiento({ ...mantenimiento, descripcion: e.target.value })} />
                <input className="sg-input" type="number" min="0" step="0.01" placeholder="Costo (opcional)" value={mantenimiento.costo} onChange={(e) => setMantenimiento({ ...mantenimiento, costo: e.target.value })} />
                <button className="sg-button-secondary" style={{ width: 'auto' }}>Registrar mantenimiento</button>
              </form>
            )}
            <ul style={styles.lista}>
              {(articulo.mantenimientos || []).length === 0 && <li style={styles.listaVacia}>Sin mantenimientos registrados.</li>}
              {(articulo.mantenimientos || []).map((m) => (
                <li key={m.id} style={styles.listaItem}>
                  <strong>{m.tipo}</strong> — {new Date(m.fecha).toLocaleDateString('es-MX')}
                  {m.descripcion && <div style={{ color: 'var(--sg-ink-soft)', fontSize: 12.5 }}>{m.descripcion}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const FORM_PRESTAMO_VACIO = {
  articulo_id: '', cantidad: 1, responsable: '', contacto: '', motivo: '',
  fecha_devolucion_programada: '', condicion_entrega: '', voluntario_id: '', actividad_id: '',
};

function nombreCompletoVoluntario(v) {
  return [v.nombre, v.apellido_paterno, v.apellido_materno].filter(Boolean).join(' ');
}

function VistaPrestamos({ prestamos, articulos, puedeGestionar, mostrarForm, onToggleForm, onCambio, onError }) {
  const [form, setForm] = useState(FORM_PRESTAMO_VACIO);
  const articulosPrestables = articulos.filter((a) => a.es_prestable);
  const [condicionRetorno, setCondicionRetorno] = useState({});

  // Vínculo real con voluntario/actividad (Fase 11): antes solo se guardaba
  // el nombre del responsable como texto libre. El backend ya admite
  // voluntario_id/actividad_id desde esa fase; esto agrega los selectores
  // que faltaban en el formulario.
  const [actividadesDisponibles, setActividadesDisponibles] = useState([]);
  const [actividadesCargadas, setActividadesCargadas] = useState(false);
  const [busquedaVoluntario, setBusquedaVoluntario] = useState('');
  const [resultadosVoluntario, setResultadosVoluntario] = useState([]);
  const [voluntarioSeleccionado, setVoluntarioSeleccionado] = useState(null);

  useEffect(() => {
    if (mostrarForm && !actividadesCargadas) {
      api.get('/actividades', { params: { limit: 100 } })
        .then(({ data }) => setActividadesDisponibles(data.actividades || []))
        .catch(() => setActividadesDisponibles([]))
        .finally(() => setActividadesCargadas(true));
    }
  }, [mostrarForm, actividadesCargadas]);

  async function buscarVoluntarioPrestamo(texto) {
    setBusquedaVoluntario(texto);
    if (texto.length < 2) { setResultadosVoluntario([]); return; }
    try {
      const { data } = await api.get('/voluntarios', { params: { busqueda: texto, activo: true } });
      setResultadosVoluntario(data.voluntarios || []);
    } catch {
      setResultadosVoluntario([]);
    }
  }

  function seleccionarVoluntarioPrestamo(v) {
    setForm((f) => ({ ...f, voluntario_id: v.id }));
    setVoluntarioSeleccionado(v);
    setBusquedaVoluntario('');
    setResultadosVoluntario([]);
  }

  function quitarVoluntarioPrestamo() {
    setForm((f) => ({ ...f, voluntario_id: '' }));
    setVoluntarioSeleccionado(null);
  }

  function limpiarFormPrestamo() {
    setForm(FORM_PRESTAMO_VACIO);
    setVoluntarioSeleccionado(null);
    setBusquedaVoluntario('');
    setResultadosVoluntario([]);
  }

  async function crearPrestamo(e) {
    e.preventDefault();
    try {
      await api.post('/inventario/prestamos', { ...form, cantidad: Number(form.cantidad) });
      limpiarFormPrestamo();
      onToggleForm();
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo registrar el préstamo.');
    }
  }

  async function devolver(id) {
    try {
      await api.put(`/inventario/prestamos/${id}/devolver`, { condicion_retorno: condicionRetorno[id] || '' });
      await onCambio();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo registrar la devolución.');
    }
  }

  return (
    <div>
      <div style={styles.barraAcciones}>
        <p style={{ color: 'var(--sg-ink-soft)', margin: 0 }}>
          Vestuario, escenografía u otros artículos prestados para eventos, con responsable y fecha de devolución.
        </p>
        {puedeGestionar && (
          <button className="sg-button-primary" style={{ width: 'auto' }} onClick={onToggleForm}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo préstamo'}
          </button>
        )}
      </div>

      {mostrarForm && (
        <form onSubmit={crearPrestamo} style={styles.formArticulo}>
          <select className="sg-input" value={form.articulo_id} onChange={(e) => setForm({ ...form, articulo_id: e.target.value })} required>
            <option value="">Selecciona un artículo</option>
            {articulosPrestables.map((a) => (<option key={a.id} value={a.id}>{a.nombre} ({a.existencias} {a.unidad} disponibles)</option>))}
          </select>
          {articulosPrestables.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', gridColumn: '1 / -1', margin: 0 }}>
              Ningún artículo está marcado como "se puede prestar" todavía. Edítalo desde su ficha en Artículos.
            </p>
          )}
          <input className="sg-input" type="number" min="1" placeholder="Cantidad" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
          <input className="sg-input" placeholder="Responsable (persona o grupo)" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required />
          <input className="sg-input" placeholder="Contacto (teléfono/correo)" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          <input className="sg-input" placeholder="Motivo / evento" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          <input className="sg-input" type="date" value={form.fecha_devolucion_programada} onChange={(e) => setForm({ ...form, fecha_devolucion_programada: e.target.value })} required />
          <input className="sg-input" placeholder="Condición de entrega" value={form.condicion_entrega} onChange={(e) => setForm({ ...form, condicion_entrega: e.target.value })} />

          <select className="sg-input" value={form.actividad_id} onChange={(e) => setForm({ ...form, actividad_id: e.target.value })}>
            <option value="">Actividad relacionada (opcional)</option>
            {actividadesDisponibles.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} — {new Date(a.fecha).toLocaleDateString('es-MX')}</option>
            ))}
          </select>

          <div style={{ ...styles.campoArticulo, gridColumn: '1 / -1' }}>
            <label htmlFor="prestamo-buscar-voluntario">Voluntario relacionado (opcional)</label>
            {voluntarioSeleccionado ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sg-badge sg-badge-success">{nombreCompletoVoluntario(voluntarioSeleccionado)}</span>
                <button type="button" className="sg-button-secondary" style={{ width: 'auto' }} onClick={quitarVoluntarioPrestamo}>Quitar</button>
              </div>
            ) : (
              <>
                <input
                  id="prestamo-buscar-voluntario"
                  className="sg-input"
                  placeholder="Buscar voluntario por nombre..."
                  value={busquedaVoluntario}
                  onChange={(e) => buscarVoluntarioPrestamo(e.target.value)}
                />
                {resultadosVoluntario.length > 0 && (
                  <ul style={styles.lista}>
                    {resultadosVoluntario.map((v) => (
                      <li key={v.id} style={styles.listaItem}>
                        <button
                          type="button"
                          onClick={() => seleccionarVoluntarioPrestamo(v)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: 0 }}
                        >
                          {nombreCompletoVoluntario(v)}{v.numero_voluntario ? ` · ${v.numero_voluntario}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <button className="sg-button-primary" style={{ width: 'auto' }}>Registrar préstamo</button>
        </form>
      )}

      {prestamos.length === 0 ? (
        <p style={{ color: 'var(--sg-ink-soft)' }}>Aún no hay préstamos registrados.</p>
      ) : (
        <div style={styles.tabla}>
          <div className="sg-table-head" style={{ ...styles.filaPrestamo, boxShadow: 'none', border: 'none', padding: '0 16px', background: 'transparent' }}>
            <span>Artículo / Responsable</span>
            <span>Devolución prog.</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {prestamos.map((p) => (
            <div key={p.id} style={styles.filaPrestamo}>
              <div>
                <strong>{p.articulo_nombre}</strong> — {p.cantidad} {p.unidad}
                <div style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>{p.responsable}{p.motivo ? ` · ${p.motivo}` : ''}</div>
                {(p.voluntario_nombre || p.actividad_nombre) && (
                  <div style={{ fontSize: 11.5, color: 'var(--sg-ink-soft)' }}>
                    {[p.voluntario_nombre, p.actividad_nombre].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13 }}>
                Devuelve: {new Date(p.fecha_devolucion_programada).toLocaleDateString('es-MX')}
              </div>
              <span className={`sg-badge ${p.estado === 'devuelto' ? 'sg-badge-success' : p.atrasado ? 'sg-badge-danger' : 'sg-badge-warning'}`}>
                {p.estado === 'devuelto' ? 'Devuelto' : p.atrasado ? 'Atrasado' : 'Prestado'}
              </span>
              {p.estado === 'prestado' && puedeGestionar && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="sg-input"
                    placeholder="Condición al devolver"
                    value={condicionRetorno[p.id] || ''}
                    onChange={(e) => setCondicionRetorno({ ...condicionRetorno, [p.id]: e.target.value })}
                  />
                  <button className="sg-button-secondary" style={{ width: 'auto' }} onClick={() => devolver(p.id)}>Devolver</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  titulo: { fontSize: 28, marginBottom: 4 },
  subtitulo: { color: 'var(--sg-ink-soft)' },
  tabs: { display: 'flex', gap: 8 },
  error: {
    background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)',
    padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16,
  },
  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 16 },
  sidebarTitulo: { fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--sg-ink-soft)', marginBottom: 6 },
  categoriaBtn: {
    textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent',
    fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)', cursor: 'pointer',
  },
  categoriaBtnActivo: { background: 'rgba(54, 169, 214, 0.12)', color: 'var(--sg-primary)' },
  subcategorias: { display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 12, marginBottom: 4 },
  subcategoriaBtn: {
    textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent',
    fontSize: 12.5, color: 'var(--sg-ink-soft)', cursor: 'pointer',
  },
  principal: { minWidth: 0 },
  barraAcciones: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  visorQr: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 16, marginBottom: 16, background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 12 },
  videoQr: { width: '100%', maxWidth: 460, maxHeight: 320, objectFit: 'cover', borderRadius: 8, background: '#101820' },
  campoArticulo: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--sg-ink-soft)' },
  opcionPrestable: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--sg-ink-soft)', alignSelf: 'center' },
  formArticulo: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10,
    padding: 16, background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 12, marginBottom: 16,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 },
  tarjeta: {
    display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', padding: 14,
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 12, cursor: 'pointer',
  },
  tarjetaFoto: {
    width: '100%', height: 90, borderRadius: 8, background: '#FAFAFC', display: 'flex',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tarjetaImg: { width: '100%', height: '100%', objectFit: 'cover' },
  qrArticulo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  qrImagen: { width: 160, height: 160, imageRendering: 'pixelated', border: '1px solid var(--sg-border)', borderRadius: 6 },
  tabla: { display: 'flex', flexDirection: 'column', gap: 8 },
  filaPrestamo: {
    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 2fr', gap: 12, alignItems: 'center',
    padding: '12px 16px', background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(31,26,46,0.5)', display: 'flex',
    alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 60, overflowY: 'auto',
  },
  panel: {
    background: 'var(--sg-surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 780,
    boxShadow: 'var(--sg-shadow)',
  },
  panelEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  panelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  panelSubtitulo: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--sg-ink-soft)', margin: '14px 0 8px' },
  dato: { fontSize: 13.5, margin: '2px 0' },
  fotosGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  fotoMini: { position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden' },
  fotoMiniImg: { width: '100%', height: '100%', objectFit: 'cover' },
  fotoEliminar: {
    position: 'absolute', top: 2, right: 2, background: 'rgba(31,26,46,0.7)', color: 'white', border: 'none',
    borderRadius: 6, width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: 1,
  },
  subirFotoBtn: {
    width: 64, height: 64, borderRadius: 8, border: '1px dashed var(--sg-border)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--sg-ink-soft)', cursor: 'pointer', textAlign: 'center',
  },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' },
  listaItem: { fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--sg-border)' },
  listaVacia: { fontSize: 13, color: 'var(--sg-ink-soft)' },
};
