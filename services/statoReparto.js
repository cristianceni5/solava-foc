const { createHash } = require('node:crypto');
const { getReparto } = require('../config/reparti');

const DURATA_CACHE_MS = 15000;

function querySqlReparto(id) {
  return require('../db/queries').eseguiQueryReparto(id);
}

// In produzione usa SQL e l'orologio di sistema; i test possono passare alternative.
function creaLetturaReparti(opzioni = {}) {
  const query = opzioni.query || querySqlReparto;
  const orologio = opzioni.orologio || Date.now;
  let durataCache = DURATA_CACHE_MS;
  if (opzioni.durataMs !== undefined) durataCache = opzioni.durataMs;

  const cache = new Map();
  const contatori = {
    lettureSql: 0,
    risposteCache: 0,
    richiesteAccorpate: 0,
    erroriSql: 0,
    durataTotaleSqlMs: 0,
    durataMaxSqlMs: 0
  };

  async function aggiornaReparto(id, nomeReparto, voce) {
    const inizio = orologio();
    contatori.lettureSql++;

    try {
      const dati = await query(id);
      const corpo = JSON.stringify({ ok: true, reparto: nomeReparto, dati: dati });
      // L'impronta cambia solo quando cambiano i dati: permette la risposta HTTP 304.
      const impronta = createHash('sha256').update(corpo).digest('base64url');
      voce.risultato = {
        corpo: corpo,
        etag: '"' + impronta + '"',
        aggiornatoIl: new Date(orologio()).toISOString()
      };
      voce.errore = null;
      return voce.risultato;
    } catch (errore) {
      contatori.erroriSql++;
      voce.errore = errore;
      voce.risultato = undefined;
      throw errore;
    } finally {
      const durata = Math.max(0, orologio() - inizio);
      contatori.durataTotaleSqlMs += durata;
      contatori.durataMaxSqlMs = Math.max(contatori.durataMaxSqlMs, durata);
      // Anche l'errore dura 15 secondi in cache, per non tempestare SQL se e offline.
      voce.scadenza = orologio() + durataCache;
    }
  }

  async function leggi(id) {
    const reparto = getReparto(id);
    if (!reparto) throw new Error('Reparto non valido');

    if (!cache.has(id)) cache.set(id, { scadenza: 0, inCorso: null });
    const voce = cache.get(id);

    // Un altro PC sta gia leggendo questo reparto: aspettiamo quella stessa query.
    if (voce.inCorso) {
      contatori.richiesteAccorpate++;
      return voce.inCorso;
    }

    // Se la lettura e ancora recente, non interroghiamo nuovamente il database.
    if (orologio() < voce.scadenza) {
      contatori.risposteCache++;
      if (voce.errore) throw voce.errore;
      return voce.risultato;
    }

    voce.inCorso = aggiornaReparto(id, reparto.nome, voce);
    try {
      return await voce.inCorso;
    } finally {
      voce.inCorso = null;
    }
  }

  function statistiche() {
    return { ...contatori };
  }
  return { leggi, statistiche };
}

const letturaReparti = creaLetturaReparti();
module.exports = {
  creaLetturaReparti: creaLetturaReparti,
  leggi: letturaReparti.leggi,
  statistiche: letturaReparti.statistiche
};
