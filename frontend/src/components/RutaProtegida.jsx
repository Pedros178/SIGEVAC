import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--sg-ink-soft)' }}>
        Cargando SIGEVAC…
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // Contraseña inicial sin cambiar: nada más se puede usar hasta que la cambie
  if (usuario.debe_cambiar_password && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />;
  }

  return children;
}
