import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Opciones de respaldo: se usan SOLO si la API no responde, para que el
 * formulario nunca se quede sin opciones. Reflejan el seed de la tabla
 * `catalogos`; la fuente de verdad es la base de datos (Administración → Catálogos).
 */
export const CATALOGOS_RESPALDO = {
  parentesco: [
    { clave: 'madre', etiqueta: 'Madre' },
    { clave: 'padre', etiqueta: 'Padre' },
    { clave: 'tutor', etiqueta: 'Tutor legal' },
    { clave: 'abuelo', etiqueta: 'Abuelo/a' },
    { clave: 'hermano', etiqueta: 'Hermano/a mayor de edad' },
  ],
  tipo_sangre: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((e) => ({ clave: e, etiqueta: e })),
};

/**
 * Carga las opciones de un catálogo desde GET /api/catalogos/:tipo.
 * Devuelve `{ opciones, cargando }`; ante un error de red usa el respaldo.
 */
export default function useCatalogo(tipo) {
  const [opciones, setOpciones] = useState(CATALOGOS_RESPALDO[tipo] || []);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    api.get(`/catalogos/${encodeURIComponent(tipo)}`)
      .then((r) => { if (activo) setOpciones(r.data.opciones || []); })
      .catch(() => { if (activo) setOpciones(CATALOGOS_RESPALDO[tipo] || []); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tipo]);

  return { opciones, cargando };
}
