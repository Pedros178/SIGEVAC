import { useRef, useState } from 'react';

export default function PadFirma({ onFirmar, onCancelar, nombreSugerido = '' }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [nombre, setNombre] = useState(nombreSugerido);

  function coordenadas(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return { x: punto.clientX - rect.left, y: punto.clientY - rect.top };
  }

  function iniciar(e) {
    dibujando.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = coordenadas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function trazar(e) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = coordenadas(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1F1A2E';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setTieneTrazo(true);
  }

  function terminar() {
    dibujando.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  }

  function confirmar() {
    if (!tieneTrazo || !nombre.trim()) return;
    const imagenPngBase64 = canvasRef.current.toDataURL('image/png');
    onFirmar({ imagenPngBase64, firmanteNombre: nombre.trim() });
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.tarjeta}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Firma electrónica</h3>
        <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginBottom: 14 }}>
          Dibuja tu firma dentro del recuadro con el mouse o el dedo (pantalla táctil).
        </p>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--sg-ink-soft)', marginBottom: 10 }}>
          Nombre de quien firma
          <input className="sg-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" />
        </label>

        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          style={styles.canvas}
          onMouseDown={iniciar}
          onMouseMove={trazar}
          onMouseUp={terminar}
          onMouseLeave={terminar}
          onTouchStart={iniciar}
          onTouchMove={trazar}
          onTouchEnd={terminar}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={confirmar} disabled={!tieneTrazo || !nombre.trim()}>
            Confirmar firma
          </button>
          <button style={styles.botonSecundario} onClick={limpiar}>Limpiar</button>
          <button style={styles.botonSecundario} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(31,26,46,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  tarjeta: {
    background: 'var(--sg-surface)', borderRadius: 16, padding: 24, width: 440,
    boxShadow: 'var(--sg-shadow)',
  },
  canvas: {
    width: '100%', height: 160, border: '1px dashed var(--sg-border)', borderRadius: 10,
    background: '#FAFAFC', touchAction: 'none', cursor: 'crosshair',
  },
  botonSecundario: {
    background: 'transparent', border: '1px solid var(--sg-border)', borderRadius: 10,
    padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)', cursor: 'pointer',
  },
};
