// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: ottenere l'anteprima da Labelary con timeout e messaggi di errore specifici.

const LABELARY_URL = 'http://api.labelary.com/v1/printers/12dpmm/labels/5.91x8.27/0/';
const TIMEOUT_ANTEPRIMA_MS = 10000;

async function generaAnteprimaEtichetta(zpl) {
  const signal = AbortSignal.timeout(TIMEOUT_ANTEPRIMA_MS);
  try {
    const risposta = await fetch(LABELARY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'image/png' },
      body: zpl,
      signal
    });
    if (!risposta.ok) {
      const dettaglio = await risposta.text();
      const errore = new Error('Labelary ha rifiutato lo ZPL');
      errore.status = 502;
      errore.dettaglio = dettaglio;
      throw errore;
    }
    // Il timeout copre anche il download dell'immagine.
    return Buffer.from(await risposta.arrayBuffer());
  } catch (err) {
    if (err.status) throw err;
    const timeout = signal.aborted || err.name === 'TimeoutError' || err.name === 'AbortError';
    const errore = new Error(timeout
      ? 'Anteprima non disponibile: Labelary non ha risposto entro 10 secondi'
      : 'Anteprima non disponibile: impossibile contattare Labelary, verificare la connessione Internet');
    errore.status = timeout ? 504 : 502;
    errore.cause = err;
    throw errore;
  }
}

module.exports = { generaAnteprimaEtichetta };
