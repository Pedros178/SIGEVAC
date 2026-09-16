import { cargarOpenCV, cargarTesseract } from './cargadorScripts';

/** Ordena 4 puntos cualesquiera como [arriba-izq, arriba-der, abajo-der, abajo-izq],
 * sin importar en qué orden los haya devuelto OpenCV o el usuario al arrastrarlos. */
function ordenarEsquinas(puntos) {
  const suma = puntos.map((p) => p.x + p.y);
  const diferencia = puntos.map((p) => p.x - p.y);
  const arribaIzq = puntos[suma.indexOf(Math.min(...suma))];
  const abajoDer = puntos[suma.indexOf(Math.max(...suma))];
  const arribaDer = puntos[diferencia.indexOf(Math.max(...diferencia))];
  const abajoIzq = puntos[diferencia.indexOf(Math.min(...diferencia))];
  return [arribaIzq, arribaDer, abajoDer, abajoIzq];
}

/**
 * Intenta detectar automáticamente las 4 esquinas de un documento dentro
 * de la foto (como hace cualquier app de escaneo de celular). Si no
 * encuentra un contorno de 4 lados suficientemente grande, regresa null
 * y quien llama debe ofrecer las esquinas por defecto (o dejar que la
 * persona las ajuste a mano).
 */
export async function detectarEsquinas(canvas) {
  await cargarOpenCV();
  const cv = window.cv;

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let mejorContorno = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.dilate(edges, dilated, kernel);
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const areaImagen = canvas.width * canvas.height;
    let mejorArea = 0;

    for (let i = 0; i < contours.size(); i += 1) {
      const contorno = contours.get(i);
      const area = cv.contourArea(contorno);
      if (area < areaImagen * 0.15) { contorno.delete(); continue; }

      const perimetro = cv.arcLength(contorno, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contorno, approx, 0.02 * perimetro, true);

      if (approx.rows === 4 && area > mejorArea) {
        if (mejorContorno) mejorContorno.delete();
        mejorContorno = approx;
        mejorArea = area;
      } else {
        approx.delete();
      }
      contorno.delete();
    }

    if (!mejorContorno) return null;

    const puntos = [];
    for (let i = 0; i < 4; i += 1) {
      puntos.push({ x: mejorContorno.data32S[i * 2], y: mejorContorno.data32S[i * 2 + 1] });
    }
    return ordenarEsquinas(puntos);
  } finally {
    mejorContorno?.delete();
    src.delete(); gray.delete(); blurred.delete(); edges.delete();
    dilated.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
  }
}

/**
 * Corrige la perspectiva (endereza) el documento según 4 esquinas dadas
 * (en coordenadas del canvas de origen) y regresa un canvas nuevo con la
 * imagen "aplanada", como si se hubiera escaneado de frente.
 */
export async function enderezarPerspectiva(canvasOrigen, esquinas) {
  await cargarOpenCV();
  const cv = window.cv;
  const [tl, tr, br, bl] = esquinas;

  const anchoMax = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
  const altoMax = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));

  const src = cv.imread(canvasOrigen);
  const origen = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const destino = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, anchoMax, 0, anchoMax, altoMax, 0, altoMax]);
  const M = cv.getPerspectiveTransform(origen, destino);
  const dst = new cv.Mat();

  try {
    cv.warpPerspective(src, dst, M, new cv.Size(anchoMax, altoMax), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const canvasDestino = document.createElement('canvas');
    canvasDestino.width = Math.max(1, Math.round(anchoMax));
    canvasDestino.height = Math.max(1, Math.round(altoMax));
    cv.imshow(canvasDestino, dst);
    return canvasDestino;
  } finally {
    src.delete(); origen.delete(); destino.delete(); M.delete(); dst.delete();
  }
}

/**
 * Mejora de contraste tipo "modo documento": escala de grises +
 * ecualización de histograma, para que el resultado se vea como un
 * escaneo limpio en vez de una foto con sombras/iluminación despareja.
 */
export async function mejorarComoEscaneo(canvasOrigen) {
  await cargarOpenCV();
  const cv = window.cv;
  const src = cv.imread(canvasOrigen);
  const gray = new cv.Mat();
  const ecualizada = new cv.Mat();
  const salida = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, ecualizada);
    cv.cvtColor(ecualizada, salida, cv.COLOR_GRAY2RGBA);

    const canvasDestino = document.createElement('canvas');
    canvasDestino.width = canvasOrigen.width;
    canvasDestino.height = canvasOrigen.height;
    cv.imshow(canvasDestino, salida);
    return canvasDestino;
  } finally {
    src.delete(); gray.delete(); ecualizada.delete(); salida.delete();
  }
}

const REGEX_CURP = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/;

/** Busca un CURP (18 caracteres con el formato oficial mexicano) dentro
 * de un bloque de texto reconocido por OCR. Regresa null si no encuentra
 * ninguna coincidencia clara — mejor no sugerir nada que sugerir mal. */
export function extraerCurp(textoOcr) {
  const limpio = textoOcr.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const coincidencia = limpio.match(REGEX_CURP);
  return coincidencia ? coincidencia[0] : null;
}

/**
 * Corre OCR sobre un canvas y regresa el texto reconocido. Se usa bajo
 * demanda (no automáticamente en cada escaneo) porque tarda varios
 * segundos la primera vez que se descarga el motor de reconocimiento.
 */
export async function reconocerTexto(canvas) {
  await cargarTesseract();
  const { createWorker } = window.Tesseract;
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/** Convierte un canvas a un File JPEG listo para subirse con el mismo
 * flujo de carga de archivos que ya usa el resto del sistema. */
export function canvasAArchivo(canvas, nombreArchivo, calidad = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('No se pudo generar la imagen final.'));
      resolve(new File([blob], nombreArchivo, { type: 'image/jpeg' }));
    }, 'image/jpeg', calidad);
  });
}
