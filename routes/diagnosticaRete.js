const express = require('express');
const statoReparto = require('../services/statoReparto');

module.exports = function creaRouterDiagnostica(diagnostica) {
  const router = express.Router();
  router.get('/api/diagnostica/rete', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const valore = req.query.dopo;
    const avvioRichiesto = req.query.avvio;
    if (valore !== undefined && (typeof valore !== 'string' || !/^\d+$/.test(valore)
        || !Number.isSafeInteger(Number(valore)))) {
      return res.status(400).json({ errore: 'Identificativo del log non valido' });
    }
    if (avvioRichiesto !== undefined && (typeof avvioRichiesto !== 'string'
        || avvioRichiesto.length > 32 || !Number.isFinite(Date.parse(avvioRichiesto)))) {
      return res.status(400).json({ errore: 'Data di avvio del log non valida' });
    }
    const dopo = valore === undefined ? undefined : Number(valore);
    res.json({ ...diagnostica.statistiche({ dopo, avvioRichiesto }), monitorReparti: statoReparto.statistiche() });
  });
  return router;
};
