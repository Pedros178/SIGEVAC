import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Voluntarios from './pages/Voluntarios.jsx';
import VoluntarioDetalle from './pages/VoluntarioDetalle.jsx';
import Actividades from './pages/Actividades.jsx';
import ActividadDetalle from './pages/ActividadDetalle.jsx';
import Reportes from './pages/Reportes.jsx';
import Administracion from './pages/Administracion.jsx';
import Portal from './pages/Portal.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <RutaProtegida>
            <Dashboard />
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
  );
}
