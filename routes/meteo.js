const router = require('express').Router();

// Matassino: coordinate del paese, condivise da tutti i PC dello stabilimento.
const URL_METEO = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=43.6262&lon=11.4844';
let cache;
let scadenza = 0;
let ultimaModifica;
let richiesta;

async function aggiornaMeteo() {
  const headers = { 'User-Agent': 'SolavaFactoryOperationPanel/1.0 https://www.solava.it' };
  if (ultimaModifica) headers['If-Modified-Since'] = ultimaModifica;
  const risposta = await fetch(URL_METEO, { headers, signal: AbortSignal.timeout(10000) });
  if (risposta.status !== 304) {
    if (!risposta.ok) throw new Error('Servizio meteo non disponibile');
    const dati = await risposta.json();
    const serie = dati.properties?.timeseries;
    if (!Array.isArray(serie) || !serie.length) throw new Error('Dati meteo non validi');
    cache = serie;
    ultimaModifica = risposta.headers.get('last-modified');
  }
  const expires = Date.parse(risposta.headers.get('expires'));
  scadenza = Math.max(Date.now() + 60000, Number.isFinite(expires) ? expires : Date.now() + 900000);
}

router.get('/api/meteo', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (Date.now() >= scadenza) {
      if (!richiesta) {
        richiesta = aggiornaMeteo().catch(errore => {
          // Evita richieste continue dai diversi PC quando il fornitore è offline.
          scadenza = Date.now() + 60000;
          throw errore;
        }).finally(() => { richiesta = undefined; });
      }
      await richiesta;
    }
    const adesso = Date.now();
    // Il primo intervallo può essere già trascorso: scegli quello più vicino a ora.
    const corrente = cache?.reduce((migliore, voce) =>
      Math.abs(Date.parse(voce.time) - adesso) < Math.abs(Date.parse(migliore.time) - adesso) ? voce : migliore);
    const temperatura = corrente?.data?.instant?.details?.air_temperature;
    const simbolo = corrente?.data?.next_1_hours?.summary?.symbol_code
      || corrente?.data?.next_6_hours?.summary?.symbol_code;
    const istante = Date.parse(corrente?.time);
    if (!Number.isFinite(temperatura) || !simbolo || !Number.isFinite(istante)
        || Math.abs(istante - adesso) > 90 * 60000) {
      throw new Error('Meteo attuale non disponibile');
    }
    res.json({ localita: 'Matassino', temperatura, simbolo, orario: corrente.time });
  } catch {
    res.status(503).json({ errore: 'Meteo non disponibile' });
  }
});

module.exports = router;
