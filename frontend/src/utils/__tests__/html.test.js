import { describe, test, expect } from 'vitest';
import { escaparHtml, construirHtmlEtiquetaQr } from '../html.js';

describe('N-06 escapado de la etiqueta QR (XSS almacenado)', () => {
  test('escaparHtml neutraliza los caracteres peligrosos', () => {
    expect(escaparHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escaparHtml(`"'&`)).toBe('&quot;&#39;&amp;');
    expect(escaparHtml(null)).toBe('');
  });

  test('un nombre malicioso no puede inyectar etiquetas en el HTML de la etiqueta', () => {
    const html = construirHtmlEtiquetaQr(
      { nombre: '</title><script>robar()</script><img src=x onerror=alert(1)>', sku: '"><svg onload=1>', codigo_qr: '<b>x</b>' },
      'blob:http://localhost/abc"onload="x'
    );
    // Solo debe existir el <script> propio de impresión; ningún elemento inyectado
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('robar()</script>');
    expect(html).toContain('window.print()');
  });

  test('conserva los datos legibles de un artículo normal', () => {
    const html = construirHtmlEtiquetaQr({ nombre: 'Sillas plegables', sku: 'ART-26-0006', codigo_qr: 'SGV-INV-26-AB12CD' }, 'blob:x');
    expect(html).toContain('<h1>Sillas plegables</h1>');
    expect(html).toContain('SKU: ART-26-0006');
  });
});
