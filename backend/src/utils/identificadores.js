const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor) {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}

module.exports = { esUuid };
