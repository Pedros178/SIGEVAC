const CuotaModel = require('../models/cuotaModel');

const CuotaController = {
  async listar(req, res, next) { try { return res.json({ cuotas: await CuotaModel.listar(req.usuario.asociacionId) }); } catch (err) { return next(err); } },
  async crear(req, res, next) {
    try {
      const monto = Number(req.body.monto);
      if (!req.body.nombre || !req.body.periodo || !Number.isFinite(monto) || monto < 0) return res.status(400).json({ error: 'nombre, periodo y monto válido son obligatorios.' });
      return res.status(201).json({ cuota: await CuotaModel.crear({ ...req.body, monto, asociacionId: req.usuario.asociacionId }) });
    } catch (err) { return next(err); }
  },
  async registrarPago(req, res, next) {
    try {
      const monto = Number(req.body.monto);
      if (!req.body.cuota_id || !req.body.voluntario_id || !Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'cuota_id, voluntario_id y monto válido son obligatorios.' });
      return res.status(201).json({ pago: await CuotaModel.registrarPago({ ...req.body, monto, usuarioId: req.usuario.id }) });
    } catch (err) { return next(err); }
  },
};
module.exports = CuotaController;
