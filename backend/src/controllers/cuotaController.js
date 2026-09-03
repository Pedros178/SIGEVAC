const CuotaModel = require('../models/cuotaModel');

const CuotaController = {
  async listar(req, res, next) { try { return res.json({ cuotas: await CuotaModel.listar(req.usuario.asociacionId) }); } catch (err) { return next(err); } },
  async crear(req, res, next) {
    try {
      const { nombre, periodo, fecha_vencimiento: fechaVencimiento } = req.body;
      const monto = Number(req.body.monto);
      if (!nombre || !periodo || !Number.isFinite(monto) || monto < 0) return res.status(400).json({ error: 'nombre, periodo y monto válido son obligatorios.' });
      return res.status(201).json({ cuota: await CuotaModel.crear({ nombre, periodo, monto, fechaVencimiento, asociacionId: req.usuario.asociacionId }) });
    } catch (err) { return next(err); }
  },
  async registrarPago(req, res, next) {
    try {
      const { cuota_id: cuotaId, voluntario_id: voluntarioId, metodo, referencia } = req.body;
      const monto = Number(req.body.monto);
      if (!cuotaId || !voluntarioId || !Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'cuota_id, voluntario_id y monto válido son obligatorios.' });
      return res.status(201).json({ pago: await CuotaModel.registrarPago({ cuotaId, voluntarioId, monto, metodo, referencia, usuarioId: req.usuario.id }) });
    } catch (err) { return next(err); }
  },
};
module.exports = CuotaController;
