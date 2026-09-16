// Iconos SVG sobrios para la página pública. Usan currentColor a propósito
// (heredan el color de texto de donde se coloquen) para no depender de una
// librería de iconos externa ni de assets adicionales.

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, focusable: false };

export function IconoWhatsApp(props) {
  return (
    <svg {...base} {...props}>
      <path
        d="M12 3a9 9 0 0 0-7.75 13.53L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path
        d="M8.6 8.3c.2-.5.4-.5.6-.5h.5c.16 0 .37 0 .53.4.2.5.66 1.66.72 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.3-.36.4-.12.12-.24.24-.1.48.13.24.6 1 1.28 1.6.9.8 1.6 1.05 1.84 1.17.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.53-.12.22.08 1.38.65 1.62.77.24.12.4.18.46.28.06.1.06.58-.14 1.14-.2.56-1.16 1.1-1.6 1.14-.42.05-.86.23-2.9-.6-2.46-1-4.02-3.5-4.14-3.66-.12-.16-.98-1.3-.98-2.48 0-1.18.62-1.75.84-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconoInstagram(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconoFacebook(props) {
  return (
    <svg {...base} {...props}>
      <path
        d="M14 21v-7h2.4l.4-3H14V9.1c0-.87.24-1.46 1.5-1.46H17V5.14C16.73 5.1 15.8 5 14.72 5 12.46 5 10.9 6.36 10.9 8.86V11H8.5v3h2.4v7h3.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconoCorreo(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4.2 6.5 7.8 6 7.8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Manos sosteniendo un corazón — misión / cuidado comunitario.
export function IconoMision(props) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...props}>
      <path
        d="M12 8.4c-1-1.9-3.6-2.4-5-1-1.5 1.4-1.4 3.7.2 5.2L12 17l4.8-4.4c1.6-1.5 1.7-3.8.2-5.2-1.4-1.4-4-.9-5 1Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path
        d="M4 17.5c1.6-1 3.2-1.2 4.4-.2l1 .8c.5.4 1.2.4 1.7 0M20 17.5c-1.6-1-3.2-1.2-4.4-.2l-1 .8c-.5.4-1.2.4-1.7 0"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

// Brújula — visión / rumbo a futuro.
export function IconoVision(props) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...props}>
      <circle cx="12" cy="12" r="8.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="m14.6 9.4-1.8 4.2-4.2 1.8 1.8-4.2 4.2-1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Cámara — usado en la sección de Galería mientras no hay fotos aún.
export function IconoGaleria(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...props}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1-1.6h6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
