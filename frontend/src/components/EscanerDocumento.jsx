import { useEffect, useRef, useState } from 'react';
import {
  detectarEsquinas, enderezarPerspectiva, mejorarComoEscaneo,
  reconocerTexto, extraerCurp, canvasAArchivo,
} from '../utils/escaneo';

const ANCHO_MAX_ORIGEN = 1600; // px — límite para no procesar fotos de celular a resolución completa (lento e innecesario)
const ANCHO_VISTA = 420; // px — tamaño en el que se muestra la foto para ajustar esquinas

/**
 * Escáner de documentos tipo "app de celular": el usuario toma o elige
 * una foto, el sistema intenta detectar las 4 esquinas del documento
 * automáticamente (y si no puede, el usuario las ajusta arrastrando),
 * se endereza la perspectiva y se mejora el contraste para que se vea
 * como un escaneo real — todo esto corre en el navegador, no en el
 * servidor. Opcionalmente puede leer el CURP con OCR como sugerencia.
 *
 * onConfirmar(file, curpSugerido) — file ya es un JPEG listo para subir
 * con el mismo flujo de carga de archivos que usa el resto del sistema.
 */
export default function EscanerDocumento({ onConfirmar, onCancelar, ofrecerLecturaCurp = false }) {
  const [paso, setPaso] = useState('capturar'); // capturar | cargando | ajustar | procesando | revisar
  const [error, setError] = useState('');
  const [imagenDataUrl, setImagenDataUrl] = useState(null);
  const [dimensionesOrigen, setDimensionesOrigen] = useState({ width: 0, height: 0 });
  const [esquinas, setEsquinas] = useState(null); // [{x,y}]  en % (0-100) relativo a la vista
  const [arrastrando, setArrastrando] = useState(null); // índice de esquina 0-3, o null
  const [canvasRecortado, setCanvasRecortado] = useState(null);
  const [canvasMejorado, setCanvasMejorado] = useState(null);
  const [usarMejorada, setUsarMejorada] = useState(true);
  const [buscandoCurp, setBuscandoCurp] = useState(false);
  const [curpDetectado, setCurpDetectado] = useState(null);
  const [ocrIntentoFallido, setOcrIntentoFallido] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);

  const canvasOrigenRef = useRef(null); // canvas oculto, a resolución completa
  const contenedorVistaRef = useRef(null);
  const videoCamaraRef = useRef(null);
  const flujoCamaraRef = useRef(null);

  useEffect(() => () => detenerCamara(), []);

  useEffect(() => {
    if (camaraActiva && videoCamaraRef.current && flujoCamaraRef.current) {
      videoCamaraRef.current.srcObject = flujoCamaraRef.current;
    }
  }, [camaraActiva]);

  function detenerCamara() {
    flujoCamaraRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoCamaraRef.current = null;
    setCamaraActiva(false);
  }

  async function abrirCamara() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('El navegador bloquea la cámara porque la página no está en HTTPS. Abre SIGEVAC desde localhost o configura HTTPS; también puedes elegir una imagen del equipo.');
      return;
    }
    try {
      const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const flujo = await navigator.mediaDevices.getUserMedia({
        video: esMovil ? { facingMode: 'environment' } : true,
        audio: false,
      });
      flujoCamaraRef.current = flujo;
      setCamaraActiva(true);
      if (videoCamaraRef.current) videoCamaraRef.current.srcObject = flujo;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('El acceso a la cámara fue bloqueado. Permite la cámara para este sitio desde el candado de la barra del navegador y vuelve a intentarlo.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró una cámara conectada. Conecta una webcam o elige una imagen del equipo.');
      } else {
        setError('No se pudo abrir la cámara. Verifica que otra aplicación no la esté usando o elige una imagen del equipo.');
      }
    }
  }

  async function tomarFoto() {
    const video = videoCamaraRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    detenerCamara();
    if (blob) await manejarSeleccionArchivo(new File([blob], `foto-documento-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  async function manejarSeleccionArchivo(archivo) {
    if (!archivo) return;
    setError('');
    setPaso('cargando');
    try {
      const dataUrl = await leerComoDataUrl(archivo);
      const img = await cargarImagen(dataUrl);

      const escala = Math.min(1, ANCHO_MAX_ORIGEN / img.naturalWidth);
      const w = Math.round(img.naturalWidth * escala);
      const h = Math.round(img.naturalHeight * escala);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvasOrigenRef.current = canvas;
      setDimensionesOrigen({ width: w, height: h });
      setImagenDataUrl(canvas.toDataURL('image/jpeg', 0.92));

      // Intentamos detectar el documento automáticamente; si falla (por
      // ejemplo, sin internet para descargar OpenCV.js) se usa un
      // rectángulo por defecto y la persona ajusta las esquinas a mano.
      let puntos = null;
      try {
        puntos = await detectarEsquinas(canvas);
      } catch {
        puntos = null;
      }
      if (!puntos) {
        puntos = [
          { x: w * 0.08, y: h * 0.08 }, { x: w * 0.92, y: h * 0.08 },
          { x: w * 0.92, y: h * 0.92 }, { x: w * 0.08, y: h * 0.92 },
        ];
      }
      setEsquinas(puntos.map((p) => ({ x: (p.x / w) * 100, y: (p.y / h) * 100 })));
      setPaso('ajustar');
    } catch (err) {
      setError('No se pudo cargar la imagen. Intenta con otra foto.');
      setPaso('capturar');
    }
  }

  function manejarPointerDown(indice, e) {
    e.preventDefault();
    setArrastrando(indice);
  }

  function manejarPointerMove(e) {
    if (arrastrando === null || !contenedorVistaRef.current) return;
    const rect = contenedorVistaRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setEsquinas((prev) => prev.map((p, i) => (i === arrastrando ? { x, y } : p)));
  }

  function manejarPointerUp() {
    setArrastrando(null);
  }

  async function manejarRecortar() {
    setPaso('procesando');
    setError('');
    try {
      const { width: w, height: h } = dimensionesOrigen;
      const esquinasPixel = esquinas.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h }));

      const recortado = await enderezarPerspectiva(canvasOrigenRef.current, esquinasPixel);
      let mejorado = null;
      try {
        mejorado = await mejorarComoEscaneo(recortado);
      } catch {
        mejorado = null; // si falla la mejora, igual se puede usar la versión recortada a color
      }

      setCanvasRecortado(recortado);
      setCanvasMejorado(mejorado);
      setUsarMejorada(!!mejorado);
      setPaso('revisar');
    } catch (err) {
      setError('No se pudo procesar la imagen con las esquinas seleccionadas. Intenta ajustarlas de nuevo.');
      setPaso('ajustar');
    }
  }

  async function manejarLeerCurp() {
    setBuscandoCurp(true);
    setOcrIntentoFallido(false);
    setError('');
    try {
      const canvasParaOcr = usarMejorada && canvasMejorado ? canvasMejorado : canvasRecortado;
      const texto = await reconocerTexto(canvasParaOcr);
      const curp = extraerCurp(texto);
      if (curp) {
        setCurpDetectado(curp);
      } else {
        setOcrIntentoFallido(true);
      }
    } catch {
      setOcrIntentoFallido(true);
    } finally {
      setBuscandoCurp(false);
    }
  }

  async function manejarConfirmar() {
    const canvasFinal = usarMejorada && canvasMejorado ? canvasMejorado : canvasRecortado;
    const archivo = await canvasAArchivo(canvasFinal, `documento-escaneado-${Date.now()}.jpg`);
    onConfirmar(archivo, curpDetectado);
  }

  return (
    <div style={estilos.fondo} onPointerMove={manejarPointerMove} onPointerUp={manejarPointerUp}>
      <div style={estilos.modal}>
        <div style={estilos.encabezado}>
          <h3 style={{ fontSize: 17, margin: 0 }}>Escanear documento</h3>
          <button type="button" onClick={onCancelar} style={estilos.botonCerrar} aria-label="Cerrar">×</button>
        </div>

        {error && <div style={estilos.error}>{error}</div>}

        {paso === 'capturar' && (
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13.5, marginBottom: 18 }}>
              Toma una foto del documento (o elige una de tu galería). El sistema recortará y
              enderezará automáticamente el documento, como un escáner de celular.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="sg-button-primary" onClick={abrirCamara} style={{ width: 'auto', padding: '12px 22px' }}>
                📹 Usar cámara
              </button>
              <label style={{ ...estilos.botonSecundario, display: 'inline-block', width: 'auto', padding: '12px 22px', cursor: 'pointer' }}>
                🖼️ Elegir de galería
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => manejarSeleccionArchivo(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        )}

        {paso === 'capturar' && camaraActiva && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            <video ref={videoCamaraRef} autoPlay playsInline muted style={{ width: 'min(100%, 520px)', maxHeight: 360, objectFit: 'cover', borderRadius: 8, background: '#101820' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
              <button type="button" className="sg-button-primary" onClick={tomarFoto} style={{ width: 'auto', padding: '10px 20px' }}>Capturar foto</button>
              <button type="button" onClick={detenerCamara} style={estilos.botonSecundario}>Cancelar cámara</button>
            </div>
          </div>
        )}

        {paso === 'cargando' && <MensajeCentrado texto="Cargando imagen y motor de escaneo… puede tardar unos segundos la primera vez." />}
        {paso === 'procesando' && <MensajeCentrado texto="Recortando y mejorando la imagen…" />}

        {paso === 'ajustar' && imagenDataUrl && (
          <div style={{ padding: 18 }}>
            <p style={{ color: 'var(--sg-ink-soft)', fontSize: 12.5, marginBottom: 10 }}>
              Ajusta las 4 esquinas para que coincidan exactamente con los bordes del documento.
            </p>
            <div
              ref={contenedorVistaRef}
              style={{ position: 'relative', width: ANCHO_VISTA, maxWidth: '100%', margin: '0 auto', touchAction: 'none' }}
            >
              <img src={imagenDataUrl} alt="Documento capturado" style={{ width: '100%', display: 'block', borderRadius: 6 }} draggable={false} />
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <polygon
                  points={esquinas.map((p) => `${p.x}%,${p.y}%`).join(' ')}
                  fill="rgba(54, 169, 214, 0.18)"
                  stroke="var(--sg-primary)"
                  strokeWidth="2"
                />
              </svg>
              {esquinas.map((p, i) => (
                <div
                  key={i}
                  onPointerDown={(e) => manejarPointerDown(i, e)}
                  style={{
                    position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
                    width: 26, height: 26, marginLeft: -13, marginTop: -13,
                    borderRadius: '50%', background: 'var(--sg-primary)', border: '3px solid white',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)', cursor: 'grab', touchAction: 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'center' }}>
              <button type="button" onClick={() => setPaso('capturar')} style={estilos.botonSecundario}>Tomar otra foto</button>
              <button type="button" onClick={manejarRecortar} className="sg-button-primary" style={{ width: 'auto', padding: '10px 20px' }}>
                Recortar y continuar
              </button>
            </div>
          </div>
        )}

        {paso === 'revisar' && (canvasRecortado || canvasMejorado) && (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
              {canvasMejorado && (
                <BotonToggle activo={usarMejorada} onClick={() => setUsarMejorada(true)}>Mejorada (recomendado)</BotonToggle>
              )}
              <BotonToggle activo={!usarMejorada} onClick={() => setUsarMejorada(false)}>Original a color</BotonToggle>
            </div>

            <div style={{ textAlign: 'center' }}>
              <VistaCanvas canvas={usarMejorada && canvasMejorado ? canvasMejorado : canvasRecortado} anchoMax={360} />
            </div>

            {ofrecerLecturaCurp && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--sg-bg)', borderRadius: 8 }}>
                {!curpDetectado ? (
                  <>
                    <button type="button"
                      onClick={manejarLeerCurp}
                      style={estilos.botonSecundario}
                      disabled={buscandoCurp}
                    >
                      {buscandoCurp ? 'Leyendo…' : '🔎 Leer CURP con OCR'}
                    </button>
                    {ocrIntentoFallido && (
                      <p style={{ fontSize: 12, color: 'var(--sg-ink-soft)', marginTop: 8 }}>
                        No se pudo leer el CURP automáticamente en esta foto. Puedes capturarlo a mano al guardar.
                      </p>
                    )}
                  </>
                ) : (
                  <div>
                    <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginBottom: 6 }}>CURP detectado (revísalo antes de usarlo):</p>
                    <input
                      className="sg-input"
                      value={curpDetectado}
                      onChange={(e) => setCurpDetectado(e.target.value.toUpperCase())}
                      style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                      maxLength={18}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'center' }}>
              <button type="button" onClick={() => setPaso('ajustar')} style={estilos.botonSecundario}>← Ajustar esquinas de nuevo</button>
              <button type="button" onClick={manejarConfirmar} className="sg-button-primary" style={{ width: 'auto', padding: '10px 20px' }}>
                Usar esta versión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MensajeCentrado({ texto }) {
  return (
    <div style={{ padding: '50px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 13.5, color: 'var(--sg-ink-soft)' }}>{texto}</div>
    </div>
  );
}

function BotonToggle({ activo, onClick, children }) {
  return (
    <button type="button"
      onClick={onClick}
      style={{
        fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 999,
        border: `1.5px solid ${activo ? 'var(--sg-primary)' : 'var(--sg-border)'}`,
        background: activo ? 'var(--sg-primary)' : 'transparent',
        color: activo ? 'white' : 'var(--sg-ink-soft)',
      }}
    >
      {children}
    </button>
  );
}

function VistaCanvas({ canvas, anchoMax }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !canvas) return;
    ref.current.src = canvas.toDataURL('image/jpeg', 0.9);
  }, [canvas]);
  const escala = canvas ? Math.min(1, anchoMax / canvas.width) : 1;
  return (
    <img
      ref={ref}
      alt="Documento procesado"
      style={{ width: canvas ? canvas.width * escala : anchoMax, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--sg-border)' }}
    />
  );
}

function leerComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const estilos = {
  fondo: {
    position: 'fixed', inset: 0, background: 'rgba(26, 18, 64, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--sg-surface)', borderRadius: 14, width: 480, maxWidth: '100%',
    maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  encabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 18px', borderBottom: '1px solid var(--sg-border)',
  },
  botonCerrar: {
    background: 'transparent', border: 'none', fontSize: 22, lineHeight: 1,
    color: 'var(--sg-ink-soft)', cursor: 'pointer', padding: 4,
  },
  error: {
    margin: '12px 18px 0', background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)',
    padding: '10px 12px', borderRadius: 8, fontSize: 13,
  },
  botonSecundario: {
    fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10,
    border: '1px solid var(--sg-border)', background: 'transparent', color: 'var(--sg-ink-soft)', cursor: 'pointer',
  },
};
