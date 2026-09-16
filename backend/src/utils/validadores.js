// Validaciones ligeras y reutilizables para endpoints públicos (sin
// autenticación), donde no hay ningún control previo sobre quién puede
// enviar datos. No pretende ser un validador de RFC 5322 completo — solo
// atrapar los casos obviamente inválidos o los payloads absurdamente
// largos que no aportan nada legítimo y solo desperdician almacenamiento.

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esCorreoValido(correo) {
  return typeof correo === 'string' && correo.length <= 254 && REGEX_CORREO.test(correo.trim());
}

/**
 * Verifica que un campo de texto libre no exceda una longitud razonable.
 * No lanza: devuelve true/false para que el llamador decida el mensaje.
 */
function longitudValida(texto, maximo) {
  return texto === undefined || texto === null || (typeof texto === 'string' && texto.length <= maximo);
}

module.exports = { esCorreoValido, longitudValida };
