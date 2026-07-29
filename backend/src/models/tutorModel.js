const { query } = require('../config/database');

const TutorModel = {
  async crear({ voluntarioId, nombre, curp, ine, telefono, correo, parentesco }, client = null) {
    const ejecutor = client || { query };
    const { rows } = await ejecutor.query(
      `INSERT INTO tutores (voluntario_id, nombre, curp, ine, telefono, correo, parentesco)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [voluntarioId, nombre, curp || null, ine || null, telefono || null, correo || null, parentesco || null]
    );
    return rows[0];
  },

  async obtenerPorVoluntario(voluntarioId) {
    const { rows } = await query(`SELECT * FROM tutores WHERE voluntario_id = $1`, [voluntarioId]);
    return rows[0] || null;
  },

  async actualizar(voluntarioId, datos) {
    const { rows } = await query(
      `UPDATE tutores SET
         nombre = COALESCE($2, nombre),
         curp = COALESCE($3, curp),
         ine = COALESCE($4, ine),
         telefono = COALESCE($5, telefono),
         correo = COALESCE($6, correo),
         parentesco = COALESCE($7, parentesco)
       WHERE voluntario_id = $1
       RETURNING *`,
      [voluntarioId, datos.nombre, datos.curp, datos.ine, datos.telefono, datos.correo, datos.parentesco]
    );
    return rows[0];
  },
};

module.exports = TutorModel;
