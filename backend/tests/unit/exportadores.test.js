const { aCsv, aXlsx, aPdf } = require('../../src/utils/exportadores');

const reporteEjemplo = {
  titulo: 'Reporte de prueba',
  columnas: [{ key: 'nombre', label: 'Nombre' }, { key: 'nota', label: 'Nota' }],
  filas: [
    { nombre: 'Ana López', nota: 10 },
    { nombre: 'Juan, "El Grande"', nota: 8 },
  ],
};

describe('utils/exportadores', () => {
  test('aCsv incluye el encabezado y escapa correctamente comas y comillas', () => {
    const csv = aCsv(reporteEjemplo);
    expect(csv).toContain('Nombre,Nota');
    expect(csv).toContain('Ana López,10');
    expect(csv).toContain('"Juan, ""El Grande"""');
  });

  test('aCsv con un reporte vacío solo contiene el encabezado', () => {
    const csv = aCsv({ ...reporteEjemplo, filas: [] });
    const lineas = csv.trim().split('\r\n');
    expect(lineas.length).toBe(1);
  });

  test('aXlsx produce un buffer con la firma de archivo ZIP/XLSX válida', async () => {
    const buffer = await aXlsx(reporteEjemplo);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 2).toString()).toBe('PK');
  });

  test('aPdf produce un buffer con la firma de archivo PDF válida', async () => {
    const buffer = await aPdf(reporteEjemplo);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('aPdf con un reporte sin filas no lanza error', async () => {
    const buffer = await aPdf({ ...reporteEjemplo, filas: [] });
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});
