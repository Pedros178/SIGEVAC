const { normalizarTelefono, enviarWhatsApp, enviarWhatsAppPlantilla } = require('../../src/utils/whatsapp');

describe('utils/whatsapp — normalizarTelefono', () => {
  test('agrega el código de país a un número local de 10 dígitos', () => {
    // Así es como se capturan los teléfonos en el sistema; Meta exige
    // formato internacional, por lo que sin esto los envíos fallarían.
    expect(normalizarTelefono('2381234567')).toBe('522381234567');
  });

  test('ignora espacios, guiones y paréntesis del capturista', () => {
    expect(normalizarTelefono('(238) 123-4567')).toBe('522381234567');
    expect(normalizarTelefono('238 123 4567')).toBe('522381234567');
    expect(normalizarTelefono('+52 238 123 4567')).toBe('522381234567');
  });

  test('deja igual un número que ya viene en formato internacional', () => {
    expect(normalizarTelefono('522381234567')).toBe('522381234567');
    expect(normalizarTelefono('5212381234567')).toBe('5212381234567');
  });

  test('devuelve null en números incompletos o vacíos, para no escribirle a alguien equivocado', () => {
    expect(normalizarTelefono('12345')).toBeNull();
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
  });
});

describe('utils/whatsapp — envío', () => {
  const entornoOriginal = { ...process.env };
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = global.fetch;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    process.env = { ...entornoOriginal };
  });

  test('no intenta enviar si WhatsApp no está configurado', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    global.fetch = jest.fn();

    const resultado = await enviarWhatsApp({ telefono: '2381234567', texto: 'hola' });

    expect(resultado.enviado).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sin plantilla configurada NO cae a texto libre, porque Meta lo rechazaría (131047)', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    delete process.env.WHATSAPP_TEMPLATE_NOTIFICACION;
    global.fetch = jest.fn();

    const resultado = await enviarWhatsApp({ telefono: '2381234567', texto: 'hola' });

    expect(resultado.enviado).toBe(false);
    expect(resultado.motivo).toMatch(/WHATSAPP_TEMPLATE_NOTIFICACION/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('envía como plantilla (no texto libre) con el teléfono normalizado', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.WHATSAPP_TEMPLATE_NOTIFICACION = 'aviso_sigevac';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.ABC' }] }),
    });

    const resultado = await enviarWhatsApp({ telefono: '2381234567', texto: 'Tu documento fue rechazado' });

    expect(resultado.enviado).toBe(true);
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo.type).toBe('template');
    expect(cuerpo.to).toBe('522381234567');
    expect(cuerpo.template.name).toBe('aviso_sigevac');
    expect(cuerpo.template.components[0].parameters[0].text).toBe('Tu documento fue rechazado');
  });

  test('traduce el error 131047 de Meta a un mensaje accionable', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 131047, message: 'Re-engagement message' } }),
    });

    await expect(
      enviarWhatsAppPlantilla({ telefono: '2381234567', plantilla: 'aviso_sigevac', parametros: ['x'] })
    ).rejects.toThrow(/ventana de 24 h/);
  });

  test('traduce el error 190 (token inválido o expirado) de Meta', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-vencido';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 190, message: 'Invalid OAuth access token' } }),
    });

    await expect(
      enviarWhatsAppPlantilla({ telefono: '2381234567', plantilla: 'aviso_sigevac' })
    ).rejects.toThrow(/WHATSAPP_ACCESS_TOKEN/);
  });

  test('no envía si el teléfono no se puede normalizar', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.WHATSAPP_TEMPLATE_NOTIFICACION = 'aviso_sigevac';
    global.fetch = jest.fn();

    const resultado = await enviarWhatsApp({ telefono: '123', texto: 'hola' });

    expect(resultado.enviado).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
