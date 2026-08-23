const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');

const VoluntarioModel = require('../models/voluntarioModel');
const TutorModel = require('../models/tutorModel');
const AsociacionModel = require('../models/asociacionModel');
const { ExpedienteModel, DocumentoModel } = require('../models/expedienteModel');
const HoraServicioModel = require('../models/horaServicioModel');
const QrModel = require('../models/qrModel');
const { obtenerArchivo } = require('../config/storage');

const MARCA = { primario: '#36A9D6', primarioOscuro: '#197DA8', tinta: '#163447', tintaSuave: '#5B7380', dorado: '#F0A800' };

function nombreCompleto(v) {
  return [v.nombre, v.apellido_paterno, v.apellido_materno].filter(Boolean).join(' ');
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) edad -= 1;
  return edad;
}

function etiquetaEstado(estado) {
  return { completo: 'Completo', en_revision: 'En revisión', incompleto: 'Incompleto' }[estado] || estado;
}

function etiquetaEstadoDocumento(estado) {
  return { pendiente: 'Pendiente', cargado: 'Cargado (por revisar)', aprobado: 'Aprobado', rechazado: 'Rechazado' }[estado] || estado;
}

/** Reúne toda la información que necesita la ficha, en un solo lugar,
 * para que el PDF y el Excel usen exactamente los mismos datos. */
async function reunirDatosFicha(voluntarioId) {
  const voluntario = await VoluntarioModel.obtenerPorId(voluntarioId);
  if (!voluntario) return null;

  const [asociacion, tipos, tutor, expediente, horas, qr] = await Promise.all([
    AsociacionModel.obtener(voluntario.asociacion_id),
    VoluntarioModel.obtenerTipos(voluntario.id),
    voluntario.es_menor_edad ? TutorModel.obtenerPorVoluntario(voluntario.id) : null,
    ExpedienteModel.obtenerPorVoluntario(voluntario.id),
    HoraServicioModel.resumenPorVoluntario(voluntario.id),
    QrModel.obtenerOCrear(voluntario.id),
  ]);
  const documentos = expediente ? await DocumentoModel.listarPorExpediente(expediente.id) : [];

  return { voluntario, asociacion, tipos, tutor, expediente, documentos, horas, qr };
}

const FichaController = {
  /**
   * GET /api/voluntarios/:id/ficha.pdf
   * Genera automáticamente la "ficha del integrante": foto, datos
   * personales, tipo de voluntariado, estado del expediente, horas de
   * servicio acumuladas y código QR — lista para imprimir o compartir.
   */
  async generarPdf(req, res, next) {
    try {
      const datos = await reunirDatosFicha(req.params.id);
      if (!datos) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      const { voluntario, asociacion, tipos, tutor, expediente, documentos, horas, qr } = datos;

      const doc = new PDFDocument({ margin: 0, size: 'letter' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ficha-${voluntario.numero_voluntario}.pdf"`);
      doc.pipe(res);

      const pageW = doc.page.width;
      const margin = 42;

      // --- Encabezado de color ---
      doc.rect(0, 0, pageW, 120).fill(MARCA.primario);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
        .text(asociacion?.nombre?.toUpperCase() || 'SIGEVAC', margin, 26, { width: pageW - margin * 2 });
      doc.fontSize(22).font('Helvetica-Bold').text('Ficha del integrante', margin, 44);
      doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
        .text(`Folio ${voluntario.numero_voluntario} · Generada el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 74);

      // --- Fotografía (si existe) ---
      const fotoX = pageW - margin - 96;
      doc.roundedRect(fotoX, 18, 96, 96, 6).fill('#FFFFFF');
      let fotoInsertada = false;
      if (voluntario.fotografia_url) {
        try {
          const imagen = await obtenerArchivo(voluntario.fotografia_url);
          doc.image(imagen, fotoX + 3, 21, { width: 90, height: 90, fit: [90, 90], align: 'center', valign: 'center' });
          fotoInsertada = true;
        } catch { /* si el archivo no es una imagen válida, se deja el placeholder */ }
      }
      if (!fotoInsertada) {
        doc.fillColor(MARCA.tintaSuave).fontSize(8).text('SIN FOTO', fotoX, 60, { width: 96, align: 'center' });
      }

      // --- Cuerpo ---
      let y = 140;
      doc.fillColor(MARCA.tinta).fontSize(18).font('Helvetica-Bold').text(nombreCompleto(voluntario), margin, y);
      y += 26;

      const clasificacion = tipos?.map((t) => t.etiqueta).join(', ') || (voluntario.es_menor_edad ? 'Menor de edad' : 'Mayor de edad');
      doc.fontSize(11).font('Helvetica').fillColor(MARCA.tintaSuave)
        .text(`${voluntario.es_menor_edad ? 'Menor de edad' : 'Mayor de edad'} · ${clasificacion}`, margin, y);
      y += 28;

      function fila(etiqueta, valor) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(MARCA.tintaSuave).text(etiqueta.toUpperCase(), margin, y);
        doc.fontSize(11).font('Helvetica').fillColor(MARCA.tinta).text(valor || '—', margin, y + 13);
        y += 38;
      }

      const edad = calcularEdad(voluntario.fecha_nacimiento);
      fila('CURP', voluntario.curp);
      fila('Fecha de nacimiento', voluntario.fecha_nacimiento
        ? `${new Date(voluntario.fecha_nacimiento).toLocaleDateString('es-MX')} (${edad} años)` : null);
      fila('Correo', voluntario.correo);
      fila('Teléfono', voluntario.telefono);
      fila('Dirección', [voluntario.direccion, voluntario.municipio_nombre, voluntario.estado_nombre].filter(Boolean).join(', '));
      fila('Contacto de emergencia', voluntario.contacto_emergencia_nombre
        ? `${voluntario.contacto_emergencia_nombre} (${voluntario.contacto_emergencia_parentesco || 'N/D'}) — ${voluntario.contacto_emergencia_telefono || 'sin teléfono'}`
        : null);

      if (voluntario.es_menor_edad && tutor) {
        fila('Tutor(a)', `${tutor.nombre} — ${tutor.parentesco || 'N/D'} — ${tutor.telefono || 'sin teléfono'}`);
      }

      fila('Horas de servicio acumuladas', `${horas.total_horas.toFixed(1)} h`);

      // --- Estado del expediente ---
      y += 6;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(MARCA.tintaSuave).text('ESTADO DEL EXPEDIENTE', margin, y);
      y += 16;
      const colorEstado = { completo: '#2F9E6E', en_revision: MARCA.dorado, incompleto: '#C4453D' }[expediente?.estado] || MARCA.tintaSuave;
      doc.roundedRect(margin, y, 160, 24, 12).fill(colorEstado);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text(`${etiquetaEstado(expediente?.estado)} · ${expediente?.porcentaje_avance ?? 0}%`, margin, y + 7, { width: 160, align: 'center' });
      y += 38;

      const anchoDoc = (pageW - margin * 2) / 2 - 6;
      documentos.forEach((docItem, i) => {
        const col = i % 2;
        const fila2 = Math.floor(i / 2);
        const x = margin + col * (anchoDoc + 12);
        const yy = y + fila2 * 16;
        const iconoEstado = { aprobado: '✓', cargado: '…', rechazado: '✗', pendiente: '○' }[docItem.estado] || '○';
        const colorTxt = { aprobado: '#2F9E6E', cargado: MARCA.dorado, rechazado: '#C4453D', pendiente: MARCA.tintaSuave }[docItem.estado];
        doc.fontSize(9).font('Helvetica').fillColor(colorTxt).text(`${iconoEstado}  ${docItem.tipo_etiqueta}`, x, yy, { width: anchoDoc });
      });
      y += Math.ceil(documentos.length / 2) * 16 + 20;

      // --- QR al pie ---
      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr.codigo, { margin: 0, width: 200 });
          const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          const qrSize = 90;
          const qrX = pageW - margin - qrSize;
          const qrY = doc.page.height - 150;
          doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
          doc.fontSize(7.5).fillColor(MARCA.tintaSuave).text('Escanea para validar identidad', qrX - 20, qrY + qrSize + 4, { width: qrSize + 40, align: 'center' });
        } catch { /* si falla la generación del QR, la ficha se genera igual sin él */ }
      }

      doc.fontSize(8).fillColor(MARCA.tintaSuave)
        .text('Generado automáticamente por SIGEVAC', margin, doc.page.height - 40);

      doc.end();
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/voluntarios/:id/ficha.xlsx
   * Misma información que la ficha en PDF, en formato de hoja de cálculo
   * (útil para llevar los datos a otro sistema o para revisión administrativa).
   */
  async generarExcel(req, res, next) {
    try {
      const datos = await reunirDatosFicha(req.params.id);
      if (!datos) return res.status(404).json({ error: 'Voluntario no encontrado.' });
      const { voluntario, tipos, tutor, expediente, documentos, horas } = datos;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SIGEVAC';
      workbook.created = new Date();

      const datosHoja = workbook.addWorksheet('Datos');
      datosHoja.columns = [{ header: 'Campo', key: 'campo', width: 30 }, { header: 'Valor', key: 'valor', width: 50 }];
      datosHoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      datosHoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6006F' } };

      const edad = calcularEdad(voluntario.fecha_nacimiento);
      [
        ['Folio', voluntario.numero_voluntario],
        ['Nombre completo', nombreCompleto(voluntario)],
        ['Clasificación', tipos?.map((t) => t.etiqueta).join(', ') || (voluntario.es_menor_edad ? 'Menor de edad' : 'Mayor de edad')],
        ['CURP', voluntario.curp || ''],
        ['Fecha de nacimiento', voluntario.fecha_nacimiento ? new Date(voluntario.fecha_nacimiento).toLocaleDateString('es-MX') : ''],
        ['Edad', edad ?? ''],
        ['Sexo', voluntario.sexo || ''],
        ['Correo', voluntario.correo || ''],
        ['Teléfono', voluntario.telefono || ''],
        ['Dirección', voluntario.direccion || ''],
        ['Municipio', voluntario.municipio_nombre || ''],
        ['Estado', voluntario.estado_nombre || ''],
        ['Tipo de sangre', voluntario.tipo_sangre || ''],
        ['Alergias', voluntario.alergias || ''],
        ['Contacto de emergencia', voluntario.contacto_emergencia_nombre || ''],
        ['Teléfono de emergencia', voluntario.contacto_emergencia_telefono || ''],
        ['Parentesco de emergencia', voluntario.contacto_emergencia_parentesco || ''],
        ...(voluntario.es_menor_edad && tutor ? [
          ['Tutor(a)', tutor.nombre || ''],
          ['CURP del tutor', tutor.curp || ''],
          ['Teléfono del tutor', tutor.telefono || ''],
          ['Parentesco del tutor', tutor.parentesco || ''],
        ] : []),
        ['Estado del expediente', etiquetaEstado(expediente?.estado)],
        ['Porcentaje de avance', `${expediente?.porcentaje_avance ?? 0}%`],
        ['Horas de servicio acumuladas', horas.total_horas.toFixed(1)],
        ['Activo', voluntario.activo ? 'Sí' : 'No'],
      ].forEach(([campo, valor]) => datosHoja.addRow({ campo, valor }));

      const docsHoja = workbook.addWorksheet('Documentos');
      docsHoja.columns = [
        { header: 'Documento', key: 'documento', width: 32 },
        { header: 'Estado', key: 'estado', width: 16 },
        { header: 'Vigencia', key: 'vigencia', width: 16 },
        { header: 'Versiones cargadas', key: 'versiones', width: 18 },
      ];
      docsHoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      docsHoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6006F' } };
      documentos.forEach((d) => docsHoja.addRow({
        documento: d.tipo_etiqueta,
        estado: etiquetaEstadoDocumento(d.estado),
        vigencia: d.vigencia_hasta ? new Date(d.vigencia_hasta).toLocaleDateString('es-MX') : '',
        versiones: d.total_versiones,
      }));

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ficha-${voluntario.numero_voluntario}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = FichaController;
