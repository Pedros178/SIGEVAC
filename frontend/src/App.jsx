import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Voluntarios from './pages/Voluntarios.jsx';
import VoluntarioDetalle from './pages/VoluntarioDetalle.jsx';
import Actividades from './pages/Actividades.jsx';
import ActividadDetalle from './pages/ActividadDetalle.jsx';
import Reportes from './pages/Reportes.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
    </Routes>
  );
}
