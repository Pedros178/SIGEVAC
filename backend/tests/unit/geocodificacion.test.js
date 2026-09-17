describe('utils/geocodificacion', () => {
  let fetchOriginal;
  let buscarLugares;
  let nombrarCoordenadas;

  beforeEach(() => {
    fetchOriginal = global.fetch;
    // Módulo nuevo en cada prueba: el caché y el control de 1 req/s viven
    // en el estado del módulo, así que reutilizarlo contaminaría los casos.
    jest.resetModules();
    ({ buscarLugares, nombrarCoordenadas } = require('../../src/utils/geocodificacion'));
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  test('envía un User-Agent identificable, como exige la política de Nominatim', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });

    await buscarLugares('Parque Juárez Tehuacán');

    const cabeceras = global.fetch.mock.calls[0][1].headers;
    expect(cabeceras['User-Agent']).toMatch(/SIGEVAC/);
    // Un User-Agent genérico de librería es justamente lo que Nominatim bloquea.
    expect(cabeceras['User-Agent']).not.toMatch(/^(node-fetch|undici|axios)/i);
  });

  test('devuelve solo los campos que el frontend necesita', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([{
        place_id: 1, display_name: 'Parque Juárez, Tehuacán', lat: '18.46', lon: '-97.39',
        licence: 'ODbL', osm_type: 'way', boundingbox: ['1', '2', '3', '4'],
      }]),
    });

    const lugares = await buscarLugares('Parque Juárez');

    expect(lugares).toEqual([
      { place_id: 1, display_name: 'Parque Juárez, Tehuacán', lat: '18.46', lon: '-97.39' },
    ]);
  });

  test('cachea búsquedas repetidas en vez de volver a pedirlas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([{ place_id: 1, display_name: 'Zócalo', lat: '19.43', lon: '-99.13' }]),
    });

    await buscarLugares('Zócalo CDMX');
    await buscarLugares('Zócalo CDMX');
    await buscarLugares('zócalo cdmx'); // misma consulta, distinta capitalización

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('no consulta si el término es demasiado corto', async () => {
    global.fetch = jest.fn();

    const lugares = await buscarLugares('ab');

    expect(lugares).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('traduce un 403 de Nominatim a un error de límite excedido', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

    await expect(buscarLugares('Tehuacán centro')).rejects.toMatchObject({ codigo: 'limite_excedido' });
  });

  test('geocodificación inversa devuelve el nombre del lugar', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ display_name: 'Tehuacán, Puebla', lat: '18.46', lon: '-97.39' }),
    });

    const lugar = await nombrarCoordenadas(18.46, -97.39);

    expect(lugar.display_name).toBe('Tehuacán, Puebla');
  });

  test('rechaza coordenadas fuera de rango sin llamar al servicio', async () => {
    global.fetch = jest.fn();

    expect(await nombrarCoordenadas(200, 0)).toBeNull();
    expect(await nombrarCoordenadas('no-es-un-numero', 0)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
