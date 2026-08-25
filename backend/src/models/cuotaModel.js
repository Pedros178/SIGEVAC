const { query } = require('../config/database');

const CuotaModel = {
  async listar(asociacionId) {
    const { rows } = await query(`SELECT c.*, COALESCE(SUM(p.monto), 0)::numeric AS total_pagado FROM cuotas c LEFT JOIN pagos_cuotas p ON p.cuota_id = c.id WHERE c.asociacion_id = $1 GROUP BY c.id ORDER BY c.creado_en DESC`, [asociacionId]);
    return rows;
  },
  async crear({ asociacionId, nombre, monto, periodo, fechaVencimiento }) {
    const { rows } = await query(`INSERT INTO cuotas (asociacion_id,nombre,monto,periodo,fecha_vencimiento) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [asociacionId, nombre, monto, periodo, fechaVencimiento || null]);
    return rows[0];
  },
  async registrarPago({ cuotaId, voluntarioId, monto, metodo, referencia, usuarioId }) {
    const { rows } = await query(`INSERT INTO pagos_cuotas (cuota_id,voluntario_id,monto,metodo,referencia,registrado_por) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM cuotas c JOIN voluntarios v ON v.asociacion_id = c.asociacion_id WHERE c.id = $1 AND v.id = $2) RETURNING *`, [cuotaId, voluntarioId, monto, metodo || 'efectivo', referencia || null, usuarioId]);
    if (!rows[0]) throw Object.assign(new Error('La cuota y el voluntario no pertenecen a la misma asociación.'), { status: 400 });
    return rows[0];
  },
};
module.exports = CuotaModel;
