// Carga perezosa de librerías pesadas de escaneo/OCR: solo se descargan la
// primera vez que alguien realmente usa el escáner, no en la carga inicial
// de la app. Ambas corren completamente en el navegador de quien las usa
// (nada se sube a un servidor externo para procesarse).

const promesasCargadas = {};

function cargarScript(src, comprobarListo) {
  if (promesasCargadas[src]) return promesasCargadas[src];

  promesasCargadas[src] = new Promise((resolve, reject) => {
    if (comprobarListo()) return resolve();

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}. Revisa tu conexión a internet.`));
    script.onload = () => {
      // OpenCV.js expone su API de forma asíncrona incluso después del
      // evento "load" del script (usa un runtime WASM); esperamos a que
      // cv.Mat exista de verdad antes de resolver.
      const intervalo = setInterval(() => {
        if (comprobarListo()) {
          clearInterval(intervalo);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(intervalo);
        if (!comprobarListo()) reject(new Error(`${src} cargó pero no se inicializó a tiempo.`));
      }, 20000);
    };
    document.head.appendChild(script);
  });

  return promesasCargadas[src];
}

export function cargarOpenCV() {
  return cargarScript(
    'https://docs.opencv.org/4.9.0/opencv.js',
    () => typeof window.cv !== 'undefined' && typeof window.cv.Mat !== 'undefined'
  );
}

export function cargarTesseract() {
  return cargarScript(
    // Copia local con versión exacta (ver public/vendor/tesseract-5.1.1/LEEME.txt): no depende de un CDN ni de una versión flotante.
    '/vendor/tesseract-5.1.1/tesseract.min.js',
    () => typeof window.Tesseract !== 'undefined'
  );
}
