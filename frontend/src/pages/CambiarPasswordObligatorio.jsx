import { PanelCambioPassword } from './Administracion.jsx';

/**
 * Pantalla que se muestra cuando la cuenta tiene una contraseña inicial/generada
 * que debe cambiarse antes de usar el sistema (la API bloquea todo lo demás).
 */
export default function CambiarPasswordObligatorio() {
  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Cambia tu contraseña inicial</h1>
      <p style={{ color: 'var(--sg-ink-soft)', marginBottom: 20 }}>
        Por seguridad, antes de continuar debes elegir una contraseña propia. Debe tener al menos 8 caracteres y no ser una contraseña común; te recomendamos una frase larga de 12 o más.
      </p>
      {/* Tras el cambio se recarga la app para obtener la sesión ya sin la marca de cambio pendiente */}
      <PanelCambioPassword onExito={() => setTimeout(() => window.location.assign('/dashboard'), 800)} />
    </main>
  );
}
