const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function escaparCsv(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function aCsv({ columnas, filas }) {
  const encabezado = columnas.map((c) => escaparCsv(c.label)).join(',');
  const lineas = filas.map((fila) => columnas.map((c) => escaparCsv(fila[c.key])).join(','));
  return ['\uFEFF' + encabezado, ...lineas].join('\r\n'); // BOM para acentos correctos en Excel
}

async function aXlsx({ titulo, columnas, filas }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGEVAC';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet(titulo.substring(0, 31));
  hoja.columns = columnas.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 2) }));
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2A86' } };

  filas.forEach((fila) => hoja.addRow(fila));

  return workbook.xlsx.writeBuffer();
}

function aPdf({ titulo, columnas, filas }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'letter', layout: filas.length && columnas.length > 5 ? 'landscape' : 'portrait' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fillColor('#3E1C60').fontSize(18).text(`SIGEVAC — ${titulo}`, { align: 'left' });
    doc.fillColor('#5B5470').fontSize(9).text(`Generado el ${new Date().toLocaleString('es-MX')}`, { align: 'left' });
    doc.moveDown(1);

    const anchoDisponible = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const anchoColumna = anchoDisponible / columnas.length;
    const inicioX = doc.page.margins.left;
    let y = doc.y;

    function dibujarFila(valores, { encabezado = false } = {}) {
      const alturaFila = 20;
      if (y + alturaFila > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      if (encabezado) {
        doc.rect(inicioX, y, anchoDisponible, alturaFila).fill('#5B2A86');
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
      } else {
        doc.fillColor('#1F1A2E').fontSize(8.5).font('Helvetica');
      }
      valores.forEach((valor, i) => {
        doc.text(String(valor ?? ''), inicioX + i * anchoColumna + 4, y + 6, { width: anchoColumna - 8, ellipsis: true });
      });
      y += alturaFila;
    }

    dibujarFila(columnas.map((c) => c.label), { encabezado: true });
    filas.forEach((fila) => dibujarFila(columnas.map((c) => fila[c.key])));

    if (filas.length === 0) {
      doc.fillColor('#5B5470').fontSize(10).text('No hay registros para este reporte.', inicioX, y + 10);
    }

    doc.end();
  });
}

module.exports = { aCsv, aXlsx, aPdf };
