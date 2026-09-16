const PDFDocument = require('pdfkit');

function nombreCompleto(v) {
  return [v.nombre, v.apellido_paterno, v.apellido_materno].filter(Boolean).join(' ');
}

function fechaLarga(fecha = new Date()) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

const PLANTILLAS = {
  carta_responsiva: {
    titulo: 'Carta Responsiva de Voluntariado',
    cuerpo: (v, asociacion) => [
      `Por medio de la presente, yo ${nombreCompleto(v)}, con CURP ${v.curp || '[Completar]'}, manifiesto mi voluntad de participar como voluntario(a) en las actividades organizadas por ${asociacion.nombre}.`,
      'Declaro que mi participación es completamente voluntaria y sin fines de lucro, y que conozco y acepto el reglamento interno de la asociación, comprometiéndome a seguir sus lineamientos de conducta y seguridad durante mi colaboración.',
      'Asimismo, libero a la asociación de responsabilidad por accidentes derivados de mi propia negligencia o del incumplimiento de las indicaciones de seguridad proporcionadas por los coordinadores de actividad.',
    ],
  },
  aviso_privacidad: {
    titulo: 'Aviso de Privacidad',
    cuerpo: (v, asociacion) => [
      `${asociacion.nombre} es responsable del tratamiento de los datos personales que usted nos proporcione, los cuales serán utilizados exclusivamente para fines de administración del voluntariado: registro, control de expedientes, control de actividades y horas de servicio, y generación de reportes internos.`,
      'Sus datos no serán compartidos con terceros ajenos a la asociación, salvo obligación legal. Usted puede ejercer sus derechos de acceso, rectificación, cancelación u oposición (derechos ARCO) directamente con la asociación.',
      `Nombre del titular: ${nombreCompleto(v)}. Fecha de recepción del presente aviso: ${fechaLarga()}.`,
    ],
  },
  reglamento_interno: {
    titulo: 'Reglamento Interno — Acuse de Recibido',
    cuerpo: (v, asociacion) => [
      `Yo, ${nombreCompleto(v)}, declaro haber recibido, leído y comprendido el reglamento interno de ${asociacion.nombre}, el cual establece las normas de conducta, puntualidad, uso de instalaciones y procedimientos de seguridad aplicables a todo el voluntariado.`,
      'Me comprometo a respetar dicho reglamento durante toda mi participación como voluntario(a), entendiendo que su incumplimiento puede derivar en la suspensión de mi colaboración con la asociación.',
    ],
  },
  uso_imagen: {
    titulo: 'Autorización de Uso de Imagen',
    cuerpo: (v, asociacion) => [
      `Yo, ${nombreCompleto(v)}, autorizo a ${asociacion.nombre} a captar, reproducir y difundir mi imagen (fotografías y/o video) tomada durante actividades, talleres y eventos organizados por la asociación, con fines de difusión institucional, redes sociales y materiales de promoción sin fines de lucro.`,
      'Esta autorización podrá ser revocada en cualquier momento mediante solicitud por escrito a la asociación, sin efectos retroactivos sobre material ya publicado.',
    ],
  },
  carta_autorizacion: {
    titulo: 'Carta de Autorización del Tutor',
    cuerpo: (v, asociacion, tutor) => [
      `Yo, ${tutor?.nombre || '[Nombre del tutor]'}, en calidad de ${tutor?.parentesco || 'tutor(a)'} de ${nombreCompleto(v)}, menor de edad, autorizo su participación como voluntario(a) en las actividades organizadas por ${asociacion.nombre}.`,
      'Declaro conocer las actividades en las que participará, y asumo la responsabilidad de informarle sobre las normas de conducta y seguridad de la asociación. Me comprometo a mantener actualizados mis datos de contacto para cualquier eventualidad relacionada con la participación del menor.',
    ],
  },
};

const TIPOS_CON_PLANTILLA = Object.keys(PLANTILLAS);

/**
 * Genera el PDF de un documento institucional a partir de su plantilla.
 * Devuelve un Buffer listo para guardarse como archivo del expediente.
 * NOTA: es una plantilla base; se recomienda validación por un asesor
 * legal de la asociación antes de su uso oficial.
 */
function generarPdfPlantilla(tipoClave, { voluntario, asociacion, tutor }) {
  const plantilla = PLANTILLAS[tipoClave];
  if (!plantilla) return null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'letter' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fillColor('#197DA8').fontSize(10).text(asociacion.nombre.toUpperCase(), { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#163447').fontSize(16).font('Helvetica-Bold').text(plantilla.titulo, { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(11).fillColor('#163447');
    plantilla.cuerpo(voluntario, asociacion, tutor).forEach((parrafo) => {
      doc.text(parrafo, { align: 'justify', lineGap: 4 });
      doc.moveDown(1);
    });

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#5B7380').text(`Tehuacán, Puebla — ${fechaLarga()}`, { align: 'right' });
    doc.moveDown(3);
    doc.text('_______________________________', { align: 'center' });
    doc.text(tipoClave === 'carta_autorizacion' ? (tutor?.nombre || 'Nombre del tutor') : nombreCompleto(voluntario), { align: 'center' });
    doc.fontSize(8.5).fillColor('#5B7380').moveDown(0.5).text(
      'Documento generado automáticamente por SIGEVAC a partir de una plantilla institucional. Requiere firma para tener validez.',
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { generarPdfPlantilla, TIPOS_CON_PLANTILLA };
