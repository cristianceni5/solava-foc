const router = require('express').Router();
const registro = require('../services/pcConnessi');

router.post('/api/presenza', async (req, res) => {
  const pagina = req.body?.pagina;
  const reparto = req.body?.reparto ?? '';
  if (typeof pagina !== 'string' || pagina.length > 250 || !/^\/[a-zA-Z0-9/_.-]*$/.test(pagina)) {
    return res.status(400).json({ errore: 'Pagina non valida' });
  }
  if (typeof reparto !== 'string' || reparto.length > 50 || (reparto && !/^[a-zA-Z0-9_-]+$/.test(reparto))) {
    return res.status(400).json({ errore: 'Identificativo reparto non valido' });
  }
  // L'indirizzo proviene dalla connessione, non dai dati inviati dal browser.
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  try {
    await registro.registra(ip, pagina, pagina.toLowerCase() === '/paginareparto.html' ? reparto : '');
    res.sendStatus(204);
  } catch (errore) {
    console.error('Errore registro PC:', errore.message);
    res.status(500).json({ errore: 'Impossibile registrare la presenza' });
  }
});

router.get('/api/pc-connessi', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await registro.elenco()); }
  catch (errore) {
    console.error('Errore lettura registro PC:', errore);
    res.status(500).json({ errore: 'Impossibile leggere i PC connessi', erroreRaw: errore.message });
  }
});
router.get('/api/pc-connessi/report', async (req, res) => {
  const giorno = req.query.giorno;
  if (giorno !== undefined && (typeof giorno !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(giorno))) {
    return res.status(400).json({ errore: 'Data non valida' });
  }
  res.set('Cache-Control', 'no-store');
  try { res.json(await registro.report(giorno)); }
  catch (errore) { res.status(500).json({ errore: 'Report giornaliero non disponibile', erroreRaw: errore.message }); }
});
module.exports = router;
