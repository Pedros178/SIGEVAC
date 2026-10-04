const { query, getClient } = require('../config/database');

const InventarioPrestamoModel = {
  async listar(asociacionId, { estado } = {}) {
    const condiciones = ['p.asociacion_id = $1'];
    const parametros = [asociacionId];
    if (estado) { parametros.push(estado); condiciones.push(`p.estado = $${parametros.length}`); }
    const { rows } = await query(
      `SELECT p.*, a.nombre AS articulo_nombre, a.unidad,
              v.nombre AS voluntario_nombre, act.nombre AS actividad_nombre,
              (p.estado = 'prestado' AND p.fecha_devolucion_programada < CURRENT_DATE) AS atrasado
       FROM inventario_prestamos p
       JOIN inventario_articulos a ON a.id = p.articulo_id
       LEFT JOIN voluntarios v ON v.id = p.voluntario_id
       LEFT JOIN actividades act ON act.id = p.actividad_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY p.estado = 'prestado' DESC, p.fecha_devolucion_programada ASC`,
      parametros
    );
    return rows;
  },

  async crear({ asociacionId, articuloId, cantidad, responsable, contacto, motivo, fechaDevolucionProgramada, condicionEntrega, registradoPor, voluntarioId, actividadId }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT * FROM inventario_articulos WHERE id = $1 AND asociacion_id = $2 FOR UPDATE`,
        [articuloId, asociacionId]
      );
      const articulo = rows[0];
      if (!articulo) throw Object.assign(new Error('Artículo no encontrado.'), { status: 404 });
      if (!articulo.es_prestable) throw Object.assign(new Error('Este artículo no está marcado como prestable.'), { status: 400 });
      // Los vínculos opcionales deben pertenecer a la MISMA asociación (antes se
      // aceptaba cualquier UUID y el listado devolvía nombres de voluntarios ajenos)
      if (voluntarioId) {
        const v = await client.query(`SELECT 1 FROM voluntarios WHERE id = $1 AND asociacion_id = $2`, [voluntarioId, asociacionId]);
        if (!v.rows[0]) throw Object.assign(new Error('Voluntario no encontrado.'), { status: 404 });
      }
      if (actividadId) {
        const a = await client.query(`SELECT 1 FROM actividades WHERE id = $1 AND asociacion_id = $2`, [actividadId, asociacionId]);
        if (!a.rows[0]) throw Object.assign(new Error('Actividad no encontrada.'), { status: 404 });
      }
      if (articulo.existencias < cantidad) throw Object.assign(new Error('No hay existencias suficientes para prestar esa cantidad.'), { status: 400 });

      await client.query(`UPDATE inventario_articulos SET existencias = existencias - $2, actualizado_en = now() WHERE id = $1`, [articuloId, cantidad]);
      const prestamo = await client.query(
        `INSERT INTO inventario_prestamos
           (asociacion_id, articulo_id, cantidad, responsable, contacto, motivo, fecha_devolucion_programada, condicion_entrega, registrado_por, voluntario_id, actividad_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [asociacionId, articuloId, cantidad, responsable, contacto || null, motivo || null, fechaDevolucionProgramada,
          condicionEntrega || null, registradoPor || null, voluntarioId || null, actividadId || null]
      );
      await client.query('COMMIT');
      return prestamo.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },

  async devolver({ id, asociacionId, condicionRetorno, estadoFisicoResultante }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT * FROM inventario_prestamos WHERE id = $1 AND asociacion_id = $2 AND estado = 'prestado' FOR UPDATE`,
        [id, asociacionId]
      );
      const prestamo = rows[0];
      if (!prestamo) throw Object.assign(new Error('Préstamo no encontrado o ya devuelto.'), { status: 404 });

      await client.query(
        `UPDATE inventario_articulos SET existencias = existencias + $2, actualizado_en = now() WHERE id = $1`,
        [prestamo.articulo_id, prestamo.cantidad]
      );
      if (estadoFisicoResultante) {
        await client.query(`UPDATE inventario_articulos SET estado_fisico = $2 WHERE id = $1`, [prestamo.articulo_id, estadoFisicoResultante]);
      }
      const actualizado = await client.query(
        `UPDATE inventario_prestamos
         SET estado = 'devuelto', fecha_devolucion_real = now(), condicion_retorno = $1
         WHERE id = $2 RETURNING *`,
        [condicionRetorno || null, id]
      );
      await client.query('COMMIT');
      return actualizado.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
};
module.exports = InventarioPrestamoModel;
