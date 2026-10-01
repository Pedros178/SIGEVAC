import React, { useEffect, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import FotoAutenticada from '../components/FotoAutenticada.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { guardarAccessToken } from '../services/api';
import SelectorUbicacionCatalogo from '../components/SelectorUbicacionCatalogo.jsx';

// Cada pestaña declara qué permiso la habilita (Módulo 23 — Panel
// Administrativo diferenciado por rol): un usuario solo ve las pestañas
// para las que el backend realmente lo autoriza.
const PESTANAS = [
  { id: 'usuarios', etiqueta: 'Usuarios', permiso: 'usuarios.consultar' },
  { id: 'galeria', etiqueta: 'Galería', permiso: 'galeria.consultar' },
  { id: 'roles', etiqueta: 'Roles y permisos', soloSuperAdmin: true },
  { id: 'cuotas', etiqueta: 'Cuotas', soloSuperAdmin: true },
  { id: 'solicitudes', etiqueta: 'Solicitudes', soloSuperAdmin: true },
  { id: 'asociaciones', etiqueta: 'Asociaciones', soloSuperAdmin: true },
  { id: 'auditoria', etiqueta: 'Auditoría', permiso: 'auditoria.consultar' },
  { id: 'bitacora', etiqueta: 'Bitácora', permiso: 'auditoria.consultar' },
  { id: 'configuracion', etiqueta: 'Configuración', permiso: 'configuracion.consultar' },
  { id: 'respaldos', etiqueta: 'Respaldos', permiso: 'respaldos.gestionar' },
];

export default function Administracion() {
  const { tienePermiso, tieneRol } = useAuth();
  const pestanasVisibles = PESTANAS.filter((p) => (p.soloSuperAdmin ? tieneRol('super_admin') : tienePermiso(p.permiso)));
  const [pestana, setPestana] = useState(pestanasVisibles[0]?.id || null);

  useEffect(() => {
    // Si el usuario no tiene acceso a la pestaña activa por defecto (o no
    // se calculó todavía cuando se montó el componente), se reubica en la
    // primera pestaña que sí puede ver.
    if (pestanasVisibles.length && !pestanasVisibles.some((p) => p.id === pestana)) {
      setPestana(pestanasVisibles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanasVisibles.map((p) => p.id).join(',')]);

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Administración</h1>
        <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14, marginBottom: 20 }}>
          Usuarios, auditoría, bitácora, configuración y respaldos (Módulos 2, 18–21, 23)
        </p>

        <PanelCambioPassword />
        <PanelSeguridad2FA />

        {pestanasVisibles.length === 0 ? (
          <Error mensaje="No tienes permiso para ver ninguna sección de administración." />
        ) : (
          <>
            <div style={styles.tabs}>
              {pestanasVisibles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPestana(p.id)}
                  style={{ ...styles.tab, ...(pestana === p.id ? styles.tabActivo : {}) }}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>

            {pestana === 'usuarios' && <PanelUsuarios />}
            {pestana === 'galeria' && <PanelGaleria />}
            {pestana === 'roles' && <PanelRoles />}
            {pestana === 'cuotas' && <PanelCuotas />}
            {pestana === 'solicitudes' && <PanelSolicitudes />}
            {pestana === 'asociaciones' && <PanelAsociaciones />}
            {pestana === 'auditoria' && <PanelAuditoria />}
            {pestana === 'bitacora' && <PanelBitacora />}
            {pestana === 'configuracion' && <PanelConfiguracion />}
            {pestana === 'respaldos' && <PanelRespaldos />}
          </>
        )}
      </div>
    </div>
  );
}

export function PanelSeguridad2FA() {
  const { usuario } = useAuth();
  const [configuracion, setConfiguracion] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [codigoDesactivar, setCodigoDesactivar] = useState('');
  const [passwordConfirmacion, setPasswordConfirmacion] = useState('');
  const [mostrarDesactivar, setMostrarDesactivar] = useState(false);
  const [dosFactorActivo, setDosFactorActivo] = useState(!!usuario?.two_factor_activo);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function preparar() {
    setCargando(true); setError(''); setMensaje('');
    try {
      // Re-autenticación: configurar un segundo factor exige la contraseña actual
      const { data } = await api.post('/auth/2fa/setup', { password: passwordConfirmacion });
      setConfiguracion(data);
      setPasswordConfirmacion('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo preparar la autenticación de dos factores.');
    } finally { setCargando(false); }
  }

  async function activar() {
    setCargando(true); setError('');
    try {
      const { data } = await api.post('/auth/2fa/enable', { codigo });
      setMensaje(data.mensaje); setConfiguracion(null); setCodigo(''); setDosFactorActivo(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo activar 2FA.');
    } finally { setCargando(false); }
  }

  async function desactivar(e) {
    e.preventDefault();
    setCargando(true); setError('');
    try {
      const { data } = await api.post('/auth/2fa/disable', { codigo: codigoDesactivar });
      setMensaje(data.mensaje); setDosFactorActivo(false); setMostrarDesactivar(false); setCodigoDesactivar('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo desactivar 2FA. Verifica el código.');
    } finally { setCargando(false); }
  }

  return (
    <section style={{ ...styles.tabla, padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Seguridad de tu cuenta</h2>
      <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13, margin: '0 0 12px' }}>
        Protege el acceso con un código temporal de Google Authenticator o Microsoft Authenticator.
      </p>
      {dosFactorActivo ? (
        mostrarDesactivar ? (
          <form onSubmit={desactivar} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="sg-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={codigoDesactivar}
              onChange={(e) => setCodigoDesactivar(e.target.value.replace(/\D/g, ''))}
              style={{ maxWidth: 180 }}
              autoFocus
            />
            <button type="submit" style={{ ...styles.botonDescargar, color: 'var(--sg-danger)', borderColor: 'var(--sg-danger)' }} disabled={cargando || codigoDesactivar.length !== 6}>
              Confirmar desactivación
            </button>
            <button type="button" style={styles.botonDescargar} onClick={() => { setMostrarDesactivar(false); setCodigoDesactivar(''); setError(''); }}>
              Cancelar
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--sg-success)', fontWeight: 600 }}>✓ Activada</span>
            <button type="button" style={styles.botonDescargar} onClick={() => setMostrarDesactivar(true)}>
              Desactivar 2FA
            </button>
          </div>
        )
      ) : !configuracion ? (
        <form onSubmit={(e) => { e.preventDefault(); preparar(); }} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="sg-input"
            type="password"
            autoComplete="current-password"
            placeholder="Confirma tu contraseña"
            aria-label="Contraseña actual"
            value={passwordConfirmacion}
            onChange={(e) => setPasswordConfirmacion(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button type="submit" style={styles.botonDescargar} disabled={cargando || !passwordConfirmacion}>
            {cargando ? 'Preparando…' : 'Configurar 2FA'}
          </button>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={configuracion.qr} alt="Código QR para configurar 2FA" width="150" height="150" />
          <div style={{ maxWidth: 360 }}>
            <p style={{ fontSize: 13, color: 'var(--sg-ink-soft)' }}>Escanea el QR y escribe el código que genere tu aplicación.</p>
            <input className="sg-input" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="sg-button-primary" style={{ marginTop: 10 }} onClick={activar} disabled={cargando || codigo.length !== 6}>Activar 2FA</button>
            <p style={{ fontSize: 11, color: 'var(--sg-ink-soft)' }}>Clave manual: {configuracion.secreto}</p>
          </div>
        </div>
      )}
      {mensaje && <p style={{ color: 'var(--sg-success)', fontSize: 13 }}>{mensaje}</p>}
      {error && <Error mensaje={error} />}
    </section>
  );
}

export function PanelCambioPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cambiar(e) {
    e.preventDefault();
    setError(''); setMensaje('');
    if (nueva !== confirmacion) { setError('La confirmación no coincide con la nueva contraseña.'); return; }
    setCargando(true);
    try {
      const { data } = await api.post('/auth/change-password', { password_actual: actual, nueva_password: nueva });
      // El backend cierra las demás sesiones y abre una nueva para este dispositivo
      if (data.access_token) guardarAccessToken(data.access_token);
      setMensaje('Contraseña actualizada. Se cerraron tus sesiones en otros dispositivos.');
      setActual(''); setNueva(''); setConfirmacion('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally { setCargando(false); }
  }

  return (
    <section style={{ ...styles.tabla, padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Cambiar contraseña</h2>
      <form onSubmit={cambiar} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="sg-input" type="password" autoComplete="current-password" placeholder="Contraseña actual" aria-label="Contraseña actual para cambiarla" value={actual} onChange={(e) => setActual(e.target.value)} style={{ maxWidth: 220 }} />
        <input className="sg-input" type="password" autoComplete="new-password" placeholder="Nueva contraseña" aria-label="Nueva contraseña" value={nueva} onChange={(e) => setNueva(e.target.value)} style={{ maxWidth: 220 }} />
        <input className="sg-input" type="password" autoComplete="new-password" placeholder="Repite la nueva contraseña" aria-label="Confirmar nueva contraseña" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} style={{ maxWidth: 220 }} />
        <button type="submit" style={styles.botonDescargar} disabled={cargando || !actual || !nueva || !confirmacion}>
          {cargando ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
      {mensaje && <p style={{ color: 'var(--sg-success)', fontSize: 13 }}>{mensaje}</p>}
      {error && <Error mensaje={error} />}
    </section>
  );
}

function useCargaProtegida(cargar, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    setError('');
    cargar()
      .then(setDatos)
      .catch((err) => setError(err.response?.status === 403
        ? 'No tienes permiso para ver esta sección.'
        : 'No se pudo cargar la información.'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { datos, error, cargando };
}

function PanelUsuarios() {
  const { tienePermiso, tieneRol } = useAuth();
  const esSuperAdmin = tieneRol('super_admin');

  const [usuarios, setUsuarios] = useState(null);
  const [roles, setRoles] = useState([]);
  const [todasAsociaciones, setTodasAsociaciones] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [expandidoId, setExpandidoId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [{ data: du }, { data: dr }] = await Promise.all([
        api.get('/usuarios'),
        api.get('/usuarios/roles/disponibles'),
      ]);
      setUsuarios(du.usuarios);
      setRoles(dr.roles);
      if (esSuperAdmin) {
        const { data: da } = await api.get('/asociacion/todas');
        setTodasAsociaciones(da.asociaciones);
      }
      setError('');
    } catch (err) {
      setError(err.response?.status === 403 ? 'No tienes permiso para ver esta sección.' : 'No se pudo cargar la información.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function alternarActivo(usuario) {
    await api.put(`/usuarios/${usuario.id}`, { activo: !usuario.activo });
    cargar();
  }

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;

  return (
    <div>
      {tienePermiso('usuarios.crear') && <FormularioNuevoUsuario roles={roles} onCreado={cargar} />}

      <div style={styles.tabla}>
        <div style={{ ...styles.filaUsuarios, ...styles.filaEncabezado }}>
          <span>Nombre</span><span>Correo</span><span>Rol(es)</span><span>Estado</span><span></span>
        </div>
        {usuarios.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--sg-ink-soft)', fontSize: 14 }}>Aún no hay usuarios registrados.</div>
        ) : usuarios.map((u) => (
          <React.Fragment key={u.id}>
            <div style={styles.filaUsuarios}>
              <span>{u.nombre}</span>
              <span>{u.correo}</span>
              <span>{(u.roles || []).map((r) => r.nombre).join(', ') || '—'}</span>
              <span>
                <span style={{ ...styles.chip, ...(u.activo ? styles.chipActivo : styles.chipInactivo) }}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {tienePermiso('usuarios.editar') && (
                  <button style={styles.botonDescargar} onClick={() => alternarActivo(u)}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
                {esSuperAdmin && (
                  <button
                    style={styles.botonDescargar}
                    onClick={() => setExpandidoId(expandidoId === u.id ? null : u.id)}
                  >
                    Asociaciones
                  </button>
                )}
              </span>
            </div>
            {expandidoId === u.id && esSuperAdmin && (
              <div style={styles.panelAsociaciones}>
                <PanelAsociacionesUsuario
                  usuarioId={u.id}
                  todasAsociaciones={todasAsociaciones}
                  onCambio={cargar}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function PanelRoles() {
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargar() {
    try {
      const [{ data: rolesData }, { data: permisosData }] = await Promise.all([
        api.get('/usuarios/roles/disponibles'), api.get('/usuarios/roles/permisos'),
      ]);
      setRoles(rolesData.roles); setPermisos(permisosData.permisos);
    } catch (err) { setError(err.response?.data?.error || 'No se pudieron cargar los roles.'); }
  }
  useEffect(() => { cargar(); }, []);

  async function crear(evento) {
    evento.preventDefault(); setError(''); setMensaje('');
    try {
      await api.post('/usuarios/roles', { nombre, descripcion });
      setNombre(''); setDescripcion(''); setMensaje('Rol creado.'); await cargar();
    } catch (err) { setError(err.response?.data?.error || 'No se pudo crear el rol.'); }
  }

  async function seleccionar(rol) {
    setSeleccionado(rol);
    try {
      const { data } = await api.get(`/usuarios/roles/${rol.id}/permisos`);
      setSeleccionados(data.permisos.map((permiso) => permiso.id));
    } catch (err) { setError(err.response?.data?.error || 'No se pudieron cargar los permisos.'); }
  }

  async function guardarPermisos() {
    setError(''); setMensaje('');
    try {
      await api.put(`/usuarios/roles/${seleccionado.id}/permisos`, { permisos_ids: seleccionados });
      setMensaje('Permisos actualizados.');
    } catch (err) { setError(err.response?.data?.error || 'No se pudieron guardar los permisos.'); }
  }

  const rolesBase = new Set(['super_admin', 'presidente', 'coordinador', 'capturista', 'supervisor', 'consulta']);
  return (
    <div>
      <form onSubmit={crear} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input className="sg-input" placeholder="Nombre del rol (ej. coordinador_eventos)" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ maxWidth: 280 }} />
        <input className="sg-input" placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ maxWidth: 280 }} />
        <button type="submit" className="sg-button-primary" style={{ width: 'auto' }}>Crear rol</button>
      </form>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <div style={styles.tabla}>
          {roles.map((rol) => <button key={rol.id} type="button" onClick={() => !rolesBase.has(rol.nombre) && seleccionar(rol)} disabled={rolesBase.has(rol.nombre)} style={{ ...styles.itemRol, ...(seleccionado?.id === rol.id ? styles.itemRolActivo : {}) }}>
            <strong>{rol.nombre}</strong><small>{rolesBase.has(rol.nombre) ? 'Rol base' : 'Personalizado'}</small>
          </button>)}
        </div>
        <div style={styles.tabla}>
          {seleccionado ? (
            <div style={{ padding: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Permisos de {seleccionado.nombre}</h3>
              {permisos.map((permiso) => <label key={permiso.id} style={styles.permiso}><input type="checkbox" checked={seleccionados.includes(permiso.id)} onChange={() => setSeleccionados((actuales) => actuales.includes(permiso.id) ? actuales.filter((id) => id !== permiso.id) : [...actuales, permiso.id])} />{permiso.clave}</label>)}
              <button type="button" className="sg-button-primary" style={{ width: 'auto', marginTop: 14 }} onClick={guardarPermisos}>Guardar permisos</button>
            </div>
          ) : <p style={{ padding: 16, color: 'var(--sg-ink-soft)' }}>Selecciona un rol personalizado.</p>}
        </div>
      </div>
      {mensaje && <p style={{ color: 'var(--sg-success)', fontSize: 13 }}>{mensaje}</p>}
      {error && <Error mensaje={error} />}
    </div>
  );
}

function PanelCuotas() {
  const [cuotas, setCuotas] = useState([]); const [form, setForm] = useState({ nombre: '', monto: '', periodo: '' }); const [pago, setPago] = useState({}); const [error, setError] = useState('');
  async function cargar() { try { const { data } = await api.get('/cuotas'); setCuotas(data.cuotas); } catch (err) { setError(err.response?.data?.error || 'No se pudieron cargar cuotas.'); } }
  useEffect(() => { cargar(); }, []);
  async function crear(e) { e.preventDefault(); try { await api.post('/cuotas', { ...form, monto: Number(form.monto) }); setForm({ nombre: '', monto: '', periodo: '' }); cargar(); } catch (err) { setError(err.response?.data?.error || 'No se pudo crear la cuota.'); } }
  async function registrarPago(id) { const datos = pago[id] || {}; try { await api.post('/cuotas/pagos', { cuota_id: id, voluntario_id: datos.voluntario_id, monto: Number(datos.monto), metodo: datos.metodo }); setPago({}); cargar(); } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar el pago.'); } }
  return <div><form onSubmit={crear} style={styles.formLinea}><input className="sg-input" placeholder="Concepto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /><input className="sg-input" type="number" min="0" step="0.01" placeholder="Monto" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required /><input className="sg-input" placeholder="Periodo (ej. 2026-08)" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} required /><button className="sg-button-primary" style={{ width: 'auto' }}>Crear cuota</button></form><div style={styles.tabla}>{cuotas.map((c) => <div key={c.id} style={styles.fila}><strong>{c.nombre}</strong><span>${c.monto} · {c.periodo}</span><span>Pagado: ${c.total_pagado}</span><div style={{ display: 'flex', gap: 6 }}><input className="sg-input" placeholder="ID voluntario" value={pago[c.id]?.voluntario_id || ''} onChange={(e) => setPago({ ...pago, [c.id]: { ...pago[c.id], voluntario_id: e.target.value } })} /><input className="sg-input" type="number" min="0.01" step="0.01" placeholder="Monto" value={pago[c.id]?.monto || ''} onChange={(e) => setPago({ ...pago, [c.id]: { ...pago[c.id], monto: e.target.value } })} /><button type="button" style={styles.botonDescargar} onClick={() => registrarPago(c.id)}>Registrar pago</button></div></div>)}</div>{error && <Error mensaje={error} />}</div>;
}

function PanelSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]); const [error, setError] = useState('');
  async function cargar() { try { const { data } = await api.get('/solicitudes'); setSolicitudes(data.solicitudes); } catch (err) { setError(err.response?.data?.error || 'No se pudieron cargar las solicitudes.'); } }
  useEffect(() => { cargar(); }, []);
  async function cambiarEstado(id, estado) { try { await api.patch(`/solicitudes/${id}/estado`, { estado }); cargar(); } catch (err) { setError(err.response?.data?.error || 'No se pudo actualizar la solicitud.'); } }
  return <div style={styles.tabla}>{solicitudes.length === 0 ? <p style={{ padding: 16, color: 'var(--sg-ink-soft)' }}>No hay solicitudes pendientes.</p> : solicitudes.map((s) => <div key={s.id} style={styles.fila}><div><strong>{s.nombre}</strong><div style={{ fontSize: 12, color: 'var(--sg-ink-soft)' }}>{s.correo}{s.telefono ? ` · ${s.telefono}` : ''}</div></div><span>{s.mensaje || 'Sin mensaje'}</span><select className="sg-input" value={s.estado} onChange={(e) => cambiarEstado(s.id, e.target.value)}><option value="pendiente">Pendiente</option><option value="en_revision">En revisión</option><option value="aprobada">Aprobada</option><option value="rechazada">Rechazada</option></select></div>)}{error && <Error mensaje={error} />}</div>;
}

/**
 * Galería pública (sección "Galería" del Home): antes era un arreglo de
 * fotos fijo en el código del frontend. Aquí la Administración puede
 * subir fotos nuevas, editar su leyenda/texto alternativo, reordenarlas,
 * ocultarlas (sin borrarlas) o eliminarlas — todo sin tocar código.
 */
// Comparación por texto (YYYY-MM-DD vs YYYY-MM-DD de hoy) para no arrastrar
// problemas de zona horaria al construir un Date a partir de una fecha sin hora.
function haVencido(vigenteHasta) {
  if (!vigenteHasta) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return vigenteHasta < hoy;
}

function PanelGaleria() {
  const { tienePermiso } = useAuth();
  const puedeGestionar = tienePermiso('galeria.gestionar');

  const [fotos, setFotos] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  async function cargar() {
    try {
      const { data } = await api.get('/galeria');
      setFotos(data.fotos);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la galería.');
    }
  }
  useEffect(() => { cargar(); }, []);

  async function cambiarPublicada(foto) {
    try {
      await api.put(`/galeria/${foto.id}`, { publicada: !foto.publicada });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar la foto.');
    }
  }

  async function mover(foto, direccion) {
    const idx = fotos.findIndex((f) => f.id === foto.id);
    const vecino = fotos[idx + direccion];
    if (!vecino) return;
    try {
      // Intercambiar el "orden" con el vecino inmediato es más simple y
      // predecible que renumerar toda la lista cada vez.
      await Promise.all([
        api.put(`/galeria/${foto.id}`, { orden: vecino.orden }),
        api.put(`/galeria/${vecino.id}`, { orden: foto.orden }),
      ]);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reordenar la foto.');
    }
  }

  async function eliminar(foto) {
    if (!window.confirm(`¿Eliminar "${foto.leyenda}" de la galería? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/galeria/${foto.id}`);
      setMensaje('Foto eliminada.');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la foto.');
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13.5, marginBottom: 16 }}>
        Estas fotos son las que se ven en la sección "Galería" del sitio público.
        {!puedeGestionar && ' Tu rol solo puede consultarlas.'}
      </p>
      {puedeGestionar && <FormularioSubirFoto onSubida={() => { setMensaje('Foto agregada.'); cargar(); }} onError={setError} />}
      {mensaje && <p style={{ color: 'var(--sg-success)', fontSize: 13, marginBottom: 12 }}>{mensaje}</p>}
      {error && <div style={{ marginBottom: 12 }}><Error mensaje={error} /></div>}

      {fotos === null ? <Cargando /> : fotos.length === 0 ? (
        <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>Todavía no hay fotos en la galería.</p>
      ) : (
        <div style={styles.galeriaAdminGrid}>
          {fotos.map((foto, idx) => (
            <div key={foto.id} style={styles.galeriaAdminTarjeta}>
              <div style={styles.galeriaAdminImgWrap}>
                <FotoAutenticada ruta={`/galeria/${foto.id}/imagen`} alt={foto.texto_alternativo} style={styles.galeriaAdminImg} onError={setError} />
                {!foto.publicada && <span style={styles.galeriaAdminBadgeOculta}>Oculta</span>}
                {foto.publicada && haVencido(foto.vigente_hasta) && (
                  <span style={{ ...styles.galeriaAdminBadgeOculta, background: 'var(--sg-danger)' }}>Vencida</span>
                )}
              </div>

              {editandoId === foto.id ? (
                <FormularioEditarFoto
                  foto={foto}
                  onGuardado={() => { setEditandoId(null); setMensaje('Foto actualizada.'); cargar(); }}
                  onCancelar={() => setEditandoId(null)}
                  onError={setError}
                />
              ) : (
                <div style={{ padding: '10px 12px' }}>
                  <strong style={{ fontSize: 13.5, display: 'block' }}>{foto.leyenda}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--sg-ink-soft)' }}>{foto.texto_alternativo}</span>
                  {foto.vigente_hasta && (
                    <span style={{ fontSize: 11, color: haVencido(foto.vigente_hasta) ? 'var(--sg-danger)' : 'var(--sg-ink-soft)', display: 'block', marginTop: 4 }}>
                      Vigente hasta: {new Date(`${foto.vigente_hasta}T00:00:00`).toLocaleDateString('es-MX')}
                    </span>
                  )}
                </div>
              )}

              {puedeGestionar && editandoId !== foto.id && (
                <div style={styles.galeriaAdminAcciones}>
                  <button className="sg-button-secondary" style={styles.botonMini} onClick={() => mover(foto, -1)} disabled={idx === 0} title="Mover arriba">↑</button>
                  <button className="sg-button-secondary" style={styles.botonMini} onClick={() => mover(foto, 1)} disabled={idx === fotos.length - 1} title="Mover abajo">↓</button>
                  <button className="sg-button-secondary" style={styles.botonMini} onClick={() => setEditandoId(foto.id)}>Editar</button>
                  <button className="sg-button-secondary" style={styles.botonMini} onClick={() => cambiarPublicada(foto)}>{foto.publicada ? 'Ocultar' : 'Publicar'}</button>
                  <button className="sg-button-secondary" style={{ ...styles.botonMini, color: 'var(--sg-danger)', borderColor: 'var(--sg-danger)' }} onClick={() => eliminar(foto)}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioSubirFoto({ onSubida, onError }) {
  const [archivo, setArchivo] = useState(null);
  const [leyenda, setLeyenda] = useState('');
  const [textoAlternativo, setTextoAlternativo] = useState('');
  const [vigenteHasta, setVigenteHasta] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = React.useRef(null);

  async function subir(e) {
    e.preventDefault();
    if (!archivo) { onError('Elige primero una imagen.'); return; }
    setSubiendo(true);
    onError('');
    try {
      const datos = new FormData();
      datos.append('imagen', archivo);
      datos.append('leyenda', leyenda);
      datos.append('texto_alternativo', textoAlternativo);
      if (vigenteHasta) datos.append('vigente_hasta', vigenteHasta);
      await api.post('/galeria', datos, { headers: { 'Content-Type': 'multipart/form-data' } });
      setArchivo(null); setLeyenda(''); setTextoAlternativo(''); setVigenteHasta('');
      if (inputRef.current) inputRef.current.value = '';
      onSubida();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form onSubmit={subir} style={{ ...styles.formLinea, alignItems: 'center', padding: 12, background: 'var(--sg-bg)', borderRadius: 'var(--sg-radius)' }}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setArchivo(e.target.files?.[0] || null)} required />
      <input className="sg-input" placeholder="Leyenda (ej. Taller de repostería)" value={leyenda} onChange={(e) => setLeyenda(e.target.value)} required maxLength={120} style={{ width: 220 }} />
      <input className="sg-input" placeholder="Texto alternativo (describe la foto)" value={textoAlternativo} onChange={(e) => setTextoAlternativo(e.target.value)} required maxLength={200} style={{ width: 260 }} />
      <input
        className="sg-input"
        type="date"
        title="Vigente hasta (opcional): la foto/cartel se oculta solo del sitio público después de esta fecha"
        value={vigenteHasta}
        onChange={(e) => setVigenteHasta(e.target.value)}
        style={{ maxWidth: 170 }}
      />
      <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={subiendo}>
        {subiendo ? 'Subiendo…' : '+ Subir foto'}
      </button>
    </form>
  );
}

function FormularioEditarFoto({ foto, onGuardado, onCancelar, onError }) {
  const [leyenda, setLeyenda] = useState(foto.leyenda);
  const [textoAlternativo, setTextoAlternativo] = useState(foto.texto_alternativo);
  const [vigenteHasta, setVigenteHasta] = useState(foto.vigente_hasta || '');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    onError('');
    try {
      // '' (fecha borrada en el input) le indica al backend que quite la
      // vigencia; el backend distingue "no enviado" (undefined) de "".
      await api.put(`/galeria/${foto.id}`, { leyenda, texto_alternativo: textoAlternativo, vigente_hasta: vigenteHasta });
      onGuardado();
    } catch (err) {
      onError(err.response?.data?.error || 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input className="sg-input" value={leyenda} onChange={(e) => setLeyenda(e.target.value)} required maxLength={120} placeholder="Leyenda" />
      <input className="sg-input" value={textoAlternativo} onChange={(e) => setTextoAlternativo(e.target.value)} required maxLength={200} placeholder="Texto alternativo" />
      <label style={{ fontSize: 11.5, color: 'var(--sg-ink-soft)' }}>
        Vigente hasta (opcional):{' '}
        <input
          className="sg-input"
          type="date"
          value={vigenteHasta}
          onChange={(e) => setVigenteHasta(e.target.value)}
          style={{ maxWidth: 150, display: 'inline-block' }}
        />
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="sg-button-primary" style={{ ...styles.botonMini, width: 'auto' }} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="sg-button-secondary" style={styles.botonMini} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function FormularioNuevoUsuario({ roles, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await api.post('/usuarios', { nombre, correo, password, rol });
      setNombre(''); setCorreo(''); setPassword(''); setRol('');
      onCreado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={crear} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div>
        <input className="sg-input" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ width: 200 }} />
      </div>
      <input className="sg-input" type="email" placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} required style={{ width: 200 }} />
      <input className="sg-input" type="password" placeholder="Contraseña (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ width: 180 }} />
      <select className="sg-input" value={rol} onChange={(e) => setRol(e.target.value)} required style={{ width: 170 }}>
        <option value="" disabled>Rol…</option>
        {roles.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
      </select>
      <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={guardando}>
        {guardando ? 'Creando…' : '+ Nuevo usuario'}
      </button>
      {error && <div style={{ width: '100%' }}><Error mensaje={error} /></div>}
    </form>
  );
}

/**
 * Multi-asociación (diferenciador): panel para que un super_admin agregue
 * o quite a un usuario de asociaciones civiles, y marque cuál es su
 * asociación predeterminada al iniciar sesión.
 */
function PanelAsociacionesUsuario({ usuarioId, todasAsociaciones, onCambio }) {
  const [asociaciones, setAsociaciones] = useState(null);
  const [seleccion, setSeleccion] = useState('');
  const [predeterminada, setPredeterminada] = useState(false);
  const [procesando, setProcesando] = useState(false);

  async function cargar() {
    const { data } = await api.get(`/usuarios/${usuarioId}/asociaciones`);
    setAsociaciones(data.asociaciones);
  }

  useEffect(() => { cargar(); }, [usuarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar(e) {
    e.preventDefault();
    if (!seleccion) return;
    setProcesando(true);
    try {
      await api.post(`/usuarios/${usuarioId}/asociaciones`, { asociacion_id: seleccion, es_predeterminada: predeterminada });
      setSeleccion(''); setPredeterminada(false);
      await cargar();
      onCambio();
    } finally {
      setProcesando(false);
    }
  }

  async function quitar(asociacionId) {
    setProcesando(true);
    try {
      await api.delete(`/usuarios/${usuarioId}/asociaciones/${asociacionId}`);
      await cargar();
      onCambio();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo quitar la asociación.');
    } finally {
      setProcesando(false);
    }
  }

  if (!asociaciones) return <Cargando />;

  const disponibles = todasAsociaciones.filter((a) => !asociaciones.some((ua) => ua.id === a.id));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {asociaciones.map((a) => (
          <span key={a.id} style={{ ...styles.chip, ...(a.es_predeterminada ? styles.chipActivo : styles.chipNeutro) }}>
            {a.nombre}{a.es_predeterminada ? ' ★' : ''}
            <button
              onClick={() => quitar(a.id)}
              disabled={procesando}
              style={styles.botonQuitarChip}
              title="Quitar de esta asociación"
            >×</button>
          </span>
        ))}
      </div>
      {disponibles.length > 0 && (
        <form onSubmit={agregar} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="sg-input" value={seleccion} onChange={(e) => setSeleccion(e.target.value)} style={{ width: 200 }}>
            <option value="">Agregar a otra asociación…</option>
            {disponibles.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)} />
            predeterminada
          </label>
          <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: 12.5 }} disabled={!seleccion || procesando}>
            Agregar
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Módulo 3 — Registro de asociaciones civiles. Es lo que habilita de
 * verdad el escenario multi-asociación: sin poder dar de alta más
 * asociaciones, "usuario_asociaciones" no tendría a qué más apuntar.
 * Reservado a super_admin porque cruza el aislamiento de datos.
 */
function PanelAsociaciones() {
  const [asociaciones, setAsociaciones] = useState(null);
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  async function cargar() {
    try {
      const { data } = await api.get('/asociacion/todas');
      setAsociaciones(data.asociaciones);
      setError('');
    } catch (err) {
      setError(err.response?.status === 403 ? 'No tienes permiso para ver esta sección.' : 'No se pudo cargar la información.');
    }
  }

  useEffect(() => { cargar(); }, []);

  function manejarCreada() {
    setMostrarForm(false);
    cargar();
  }

  if (error) return <Error mensaje={error} />;
  if (!asociaciones) return <Cargando />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--sg-ink-soft)', margin: 0 }}>
          {asociaciones.length} asociación(es) registrada(s) en el sistema.
        </p>
        {!mostrarForm && (
          <button className="sg-button-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} onClick={() => setMostrarForm(true)}>
            + Nueva asociación
          </button>
        )}
      </div>

      {mostrarForm && <FormularioNuevaAsociacion onCreada={manejarCreada} onCancelar={() => setMostrarForm(false)} />}

      <TablaGenerica
        columnas={['Nombre', 'Municipio', 'Estado', 'Correo', 'Activa']}
        filas={asociaciones.map((a) => [a.nombre, a.municipio || '—', a.estado || '—', a.correo || '—', a.activo ? 'Sí' : 'No'])}
        vacio="Aún no hay asociaciones registradas."
      />
    </div>
  );
}

function FormularioNuevaAsociacion({ onCreada, onCancelar }) {
  const [form, setForm] = useState({ nombre: '', rfc: '', municipio: '', estado: '', telefono: '', correo: '', representante_legal: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await api.post('/asociacion', form);
      onCreada();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la asociación.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={crear} style={{ ...styles.tabla, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sg-input" placeholder="Nombre de la asociación *" value={form.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required style={{ minWidth: 220 }} />
        <input className="sg-input" placeholder="RFC" value={form.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} style={{ width: 160 }} />
        <SelectorUbicacionCatalogo estado={form.estado} municipio={form.municipio} onEstadoChange={(valor) => actualizarCampo('estado', valor)} onMunicipioChange={(valor) => actualizarCampo('municipio', valor)} compacto />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sg-input" placeholder="Teléfono" value={form.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} style={{ width: 160 }} />
        <input className="sg-input" type="email" placeholder="Correo" value={form.correo} onChange={(e) => actualizarCampo('correo', e.target.value)} style={{ width: 220 }} />
        <input className="sg-input" placeholder="Representante legal" value={form.representante_legal} onChange={(e) => actualizarCampo('representante_legal', e.target.value)} style={{ minWidth: 220 }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear asociación'}
        </button>
        <button type="button" onClick={onCancelar} style={styles.botonDescargar}>Cancelar</button>
      </div>
      {error && <Error mensaje={error} />}
    </form>
  );
}

function PanelAuditoria() {
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/auditoria').then((r) => r.data.auditoria));
  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;
  return (
    <TablaGenerica
      columnas={['Acción', 'Módulo', 'Usuario', 'Fecha']}
      filas={datos.map((r) => [r.accion, r.modulo_afectado, r.usuario_nombre || '—', new Date(r.creado_en).toLocaleString('es-MX')])}
      vacio="Aún no hay acciones registradas."
    />
  );
}

function PanelBitacora() {
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/auditoria/bitacora').then((r) => r.data.bitacora));
  async function descargarBitacora() {
    const { data } = await api.get('/auditoria/bitacora?formato=csv', { responseType: 'blob' });
    const enlace = URL.createObjectURL(data);
    const elemento = document.createElement('a');
    elemento.href = enlace;
    elemento.download = 'sigevac-bitacora.csv';
    elemento.click();
    URL.revokeObjectURL(enlace);
  }
  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" style={styles.botonDescargar} onClick={descargarBitacora}>Descargar CSV</button>
      </div>
      <TablaGenerica
        columnas={['Evento', 'Estado', 'Duración', 'Fecha']}
        filas={datos.map((r) => [r.evento, r.contexto?.status, `${r.contexto?.duracion_ms ?? '—'} ms`, new Date(r.creado_en).toLocaleString('es-MX')])}
        vacio="Aún no hay actividad registrada."
      />
    </div>
  );
}

function PanelConfiguracion() {
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso('configuracion.editar');
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/configuracion').then((r) => r.data.configuracion));
  const [clave, setClave] = useState('');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [items, setItems] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [resultadoRevision, setResultadoRevision] = useState(null);

  useEffect(() => { if (datos) setItems(datos); }, [datos]);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      let valorFinal = valor;
      try { valorFinal = JSON.parse(valor); } catch { /* se guarda como texto plano */ }
      await api.put(`/configuracion/${encodeURIComponent(clave)}`, { valor: valorFinal });
      const { data } = await api.get('/configuracion');
      setItems(data.configuracion);
      setClave(''); setValor('');
    } finally {
      setGuardando(false);
    }
  }

  async function revisarVigenciasAhora() {
    setRevisando(true);
    setResultadoRevision(null);
    try {
      const { data } = await api.post('/configuracion/vigencias/revisar');
      setResultadoRevision(data.resultado);
    } catch {
      setResultadoRevision({ error: true });
    } finally {
      setRevisando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;

  return (
    <div>
      {puedeEditar && (
        <form onSubmit={guardar} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input className="sg-input" placeholder="Clave (p. ej. dias_alerta_vigencia)" value={clave} onChange={(e) => setClave(e.target.value)} required style={{ maxWidth: 260 }} />
          <input className="sg-input" placeholder="Valor (texto o JSON)" value={valor} onChange={(e) => setValor(e.target.value)} required style={{ maxWidth: 260 }} />
          <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
      <TablaGenerica
        columnas={['Clave', 'Valor']}
        filas={(items || []).map((i) => [i.clave, JSON.stringify(i.valor)])}
        vacio="Sin configuración personalizada todavía."
      />

      {puedeEditar && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--sg-border)' }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Vigencia de documentos (Módulo 17)</h3>
          <p style={{ fontSize: 13, color: 'var(--sg-ink-soft)', marginBottom: 10 }}>
            Todos los días a las 8:00 a.m. el sistema revisa automáticamente los documentos aprobados cuya
            vigencia está por vencer (usa <code>dias_alerta_vigencia</code>, 30 por defecto) y notifica al
            voluntario y a la asociación. También puedes forzar la revisión ahora mismo:
          </p>
          <button
            className="sg-button-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
            onClick={revisarVigenciasAhora}
            disabled={revisando}
          >
            {revisando ? 'Revisando…' : 'Revisar vigencias ahora'}
          </button>
          {resultadoRevision && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              {resultadoRevision.error ? (
                <Error mensaje="No se pudo ejecutar la revisión." />
              ) : (
                <span style={{ color: 'var(--sg-ink-soft)' }}>
                  {resultadoRevision.documentos_revisados} documento(s) próximos a vencer encontrados,
                  {' '}{resultadoRevision.notificados} notificado(s) correctamente
                  {resultadoRevision.errores > 0 ? `, ${resultadoRevision.errores} con error` : ''}.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PanelRespaldos() {
  const [respaldos, setRespaldos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get('/respaldos');
      setRespaldos(data.respaldos);
      setError('');
    } catch (err) {
      setError(err.response?.status === 403 ? 'No tienes permiso para ver esta sección.' : 'No se pudo cargar la información.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function generar() {
    setGenerando(true);
    try {
      await api.post('/respaldos', {});
      await cargar();
    } catch {
      setError('No se pudo generar el respaldo.');
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(id) {
    const respuesta = await api.get(`/respaldos/${id}/descargar`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([respuesta.data]));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `sigevac_respaldo_${id}.sql`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.URL.revokeObjectURL(url);
  }

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;

  return (
    <div>
      <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px', marginBottom: 16 }} onClick={generar} disabled={generando}>
        {generando ? 'Generando respaldo…' : '+ Generar respaldo ahora'}
      </button>
      <div style={styles.tabla}>
        <div style={{ ...styles.fila, ...styles.filaEncabezado }}>
          <span>Fecha</span><span>Tamaño</span><span>Generado por</span><span></span>
        </div>
        {respaldos.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--sg-ink-soft)', fontSize: 14 }}>Aún no se ha generado ningún respaldo.</div>
        ) : respaldos.map((r) => (
          <div key={r.id} style={styles.fila}>
            <span>{new Date(r.creado_en).toLocaleString('es-MX')}</span>
            <span>{(r.tamano_bytes / 1024).toFixed(1)} KB</span>
            <span>{r.generado_por_nombre || '—'}</span>
            <button style={styles.botonDescargar} onClick={() => descargar(r.id)}>Descargar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TablaGenerica({ columnas, filas, vacio }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columnas.map((c) => <th key={c} style={styles.th}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr><td colSpan={columnas.length} style={{ padding: 20, textAlign: 'center', color: 'var(--sg-ink-soft)' }}>{vacio}</td></tr>
          ) : filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((valor, j) => <td key={j} style={styles.td}>{String(valor ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cargando() { return <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>Cargando…</p>; }
function Error({ mensaje }) {
  return <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5 }}>{mensaje}</div>;
}

const styles = {
  contenedor: { maxWidth: 1080, margin: '0 auto', padding: '32px 24px 60px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--sg-border)' },
  tab: {
    padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)',
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer',
  },
  tabActivo: { color: 'var(--sg-primary)', borderBottomColor: 'var(--sg-primary)' },
  th: {
    textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--sg-border)',
    color: 'var(--sg-ink-soft)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--sg-border)' },
  tabla: { background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', overflow: 'hidden' },
  fila: {
    display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr auto', gap: 12, alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid var(--sg-border)', fontSize: 13.5,
  },
  filaEncabezado: {
    fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    color: 'var(--sg-ink-soft)', background: 'var(--sg-bg)',
  },
  botonDescargar: {
    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', background: 'transparent', cursor: 'pointer',
  },
  filaUsuarios: {
    display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1.2fr 0.8fr auto', gap: 12, alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid var(--sg-border)', fontSize: 13.5,
  },
  panelAsociaciones: {
    padding: '12px 16px', background: 'var(--sg-bg)', borderBottom: '1px solid var(--sg-border)',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
    padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.02em',
  },
  chipActivo: { background: 'rgba(76, 148, 92, 0.14)', color: 'var(--sg-success, #4C945C)' },
  chipInactivo: { background: 'rgba(196, 69, 61, 0.12)', color: 'var(--sg-danger)' },
  chipNeutro: { background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary)' },
  botonQuitarChip: {
    border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700,
    color: 'inherit', fontSize: 13, lineHeight: 1, padding: 0,
  },
  itemRol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--sg-border)', background: 'transparent', color: 'var(--sg-ink)', cursor: 'pointer', textAlign: 'left' },
  itemRolActivo: { background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary)' },
  permiso: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 8 },
  formLinea: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  galeriaAdminGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  galeriaAdminTarjeta: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', overflow: 'hidden',
  },
  galeriaAdminImgWrap: { position: 'relative', width: '100%', height: 140, background: 'var(--sg-bg)' },
  galeriaAdminImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  galeriaAdminBadgeOculta: {
    position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)', color: 'white',
    fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  galeriaAdminAcciones: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 12px' },
  botonMini: { fontSize: 11.5, padding: '5px 9px', width: 'auto' },
};
