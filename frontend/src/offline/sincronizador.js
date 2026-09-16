import api from '../services/api';
import { listarAccionesPendientes, eliminarAccion, incrementarIntentos } from './db';

const MAX_INTENTOS = 5;

/**
 * Intenta enviar todas las acciones pendientes al servidor, en el orden
 * en que se capturaron (importante: una salida depende de que su entrada
 * ya se haya procesado). Es seguro llamarla varias veces seguidas o desde
 * varios lugares a la vez: cada acción exitosa o "ya aplicada" se retira
 * de la cola, y las que fallan por red simplemente se reintentan después.
 *
 * @returns {Promise<{ sincronizadas: number, fallidas: number, pendientes: number }>}
 */
export async function sincronizarPendientes() {
  const acciones = await listarAccionesPendientes();
  acciones.sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));

  let sincronizadas = 0;
  let fallidas = 0;

  for (const accion of acciones) {
    try {
      await enviarAccion(accion);
      await eliminarAccion(accion.id);
      sincronizadas += 1;
    } catch (err) {
      const esConflictoConocido = err.response?.status === 409 || err.response?.status === 404;
      if (esConflictoConocido) {
        // Ya se había registrado por otro medio (p.ej. otro dispositivo
        // con conexión, o QR) — no es un error real, se descarta.
        await eliminarAccion(accion.id);
        continue;
      }
      const esErrorDelServidor = err.response?.status >= 400;
      if (esErrorDelServidor) {
        // Error real de validación (no de red): no se va a resolver solo
        // reintentando. Se descarta tras el primer intento para no
        // atascar la cola con una acción que nunca va a pasar.
        console.error('Acción offline rechazada por el servidor, se descarta:', accion, err.response?.data);
        await eliminarAccion(accion.id);
        fallidas += 1;
        continue;
      }
      // Error de red: se conserva en la cola para reintentar más tarde.
      await incrementarIntentos(accion.id);
      if (accion.intentos + 1 >= MAX_INTENTOS) {
        console.warn('Acción offline con múltiples fallos de red, se seguirá reintentando:', accion);
      }
      fallidas += 1;
    }
  }

  const pendientes = await listarAccionesPendientes();
  return { sincronizadas, fallidas, pendientes: pendientes.length };
}

async function enviarAccion(accion) {
  const payload = { horaCliente: accion.horaCliente };
  if (accion.tipo === 'salida' && accion.observaciones) payload.observaciones = accion.observaciones;

  if (accion.tipo === 'entrada') {
    return api.post(`/participaciones/${accion.participacionId}/entrada`, payload);
  }
  return api.post(`/participaciones/${accion.participacionId}/salida`, payload);
}
