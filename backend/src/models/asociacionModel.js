const { query } = require('../config/database');

const AsociacionModel = {
  async obtener(id) {
    const { rows } = await query(`SELECT * FROM asociaciones WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async listar() {
    const { rows } = await query(
      `SELECT id, nombre, municipio, estado, correo, activo, creado_en
       FROM asociaciones ORDER BY creado_en`
    );
    return rows;
  },

  async actualizar(id, datos) {
    const campos = [
      'nombre', 'rfc', 'logo_url', 'direccion', 'municipio', 'estado',
      'telefono', 'correo', 'representante_legal',
    ];
    const sets = [];
    const valores = [];
    let i = 1;

    for (const campo of campos) {
      if (datos[campo] !== undefined) {
        sets.push(`${campo} = $${i}`);
        valores.push(datos[campo]);
        i += 1;
      }
    }
    if (sets.length === 0) return this.obtener(id);

    valores.push(id);
    const { rows } = await query(
      `UPDATE asociaciones SET ${sets.join(', ')}, actualizado_en = now()
       WHERE id = $${i} RETURNING *`,
      valores
    );
    return rows[0];
  },

  async crear(datos) {
    const { rows } = await query(
      `INSERT INTO asociaciones (nombre, rfc, direccion, municipio, estado, telefono, correo, representante_legal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        datos.nombre, datos.rfc || null, datos.direccion || null, datos.municipio || null,
        datos.estado || null, datos.telefono || null, datos.correo || null,
        datos.representante_legal || null,
      ]
    );
    return rows[0];
  },
};

module.exports = AsociacionModel;
