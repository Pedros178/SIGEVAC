import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';

// Home y Login son la puerta de entrada pública: se cargan de inmediato
// para que la primera pantalla no tenga que esperar a un chunk extra.
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';

// El resto son pantallas internas (requieren sesión) o secundarias:
// se dividen en chunks propios con import() dinámico para que el
// bundle inicial no cargue código que la mayoría de visitantes
// (público general, sin sesión) nunca va a ejecutar.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Voluntarios = lazy(() => import('./pages/Voluntarios.jsx'));
const VoluntarioDetalle = lazy(() => import('./pages/VoluntarioDetalle.jsx'));
const Actividades = lazy(() => import('./pages/Actividades.jsx'));
const ActividadDetalle = lazy(() => import('./pages/ActividadDetalle.jsx'));
const Reportes = lazy(() => import('./pages/Reportes.jsx'));
const Administracion = lazy(() => import('./pages/Administracion.jsx'));
const Inventario = lazy(() => import('./pages/Inventario.jsx'));
const Portal = lazy(() => import('./pages/Portal.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const SolicitudVoluntariado = lazy(() => import('./pages/SolicitudVoluntariado.jsx'));
const CertificadoPublico = lazy(() => import('./pages/CertificadoPublico.jsx'));

function CargandoRuta() {
  return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--sg-ink-soft)' }}>
        Cargando…
      </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<CargandoRuta />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portal" element={<Portal />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/solicitud" element={<SolicitudVoluntariado />} />
        <Route path="/certificado" element={<CertificadoPublico />} />
        <Route
          path="/dashboard"
          element={
            <RutaProtegida>
              <Dashboard />
            </RutaProtegida>
          }
        />
        <Route
          path="/inventario"
          element={
            <RutaProtegida>
              <Inventario />
            </RutaProtegida>
          }
        />
        <Route
          path="/voluntarios"
          element={
            <RutaProtegida>
              <Voluntarios />
            </RutaProtegida>
          }
        />
        <Route
          path="/voluntarios/:id"
          element={
            <RutaProtegida>
              <VoluntarioDetalle />
            </RutaProtegida>
          }
        />
        <Route
          path="/actividades"
          element={
            <RutaProtegida>
              <Actividades />
            </RutaProtegida>
          }
        />
        <Route
          path="/actividades/:id"
          element={
            <RutaProtegida>
              <ActividadDetalle />
            </RutaProtegida>
          }
        />
        <Route
          path="/reportes"
          element={
            <RutaProtegida>
              <Reportes />
            </RutaProtegida>
          }
        />
        <Route
          path="/administracion"
          element={
            <RutaProtegida>
              <Administracion />
            </RutaProtegida>
          }
        />
      </Routes>
      </Suspense>
  );
}
