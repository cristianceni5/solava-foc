const { getReparto } = require('../config/reparti');

const MAX_RICHIESTE_LOG = 500;
const MAX_PERCORSI = 100;
const MINUTI_TREND = 30;
const MINUTO_MS = 60000;

function arrotonda(valore) {
  return Math.round(valore * 100) / 100;
}

function misuraTempo() {
  return process.hrtime.bigint();
}

function dimensioneBlocco(blocco, codifica) {
  if (typeof blocco === 'string') {
    if (typeof codifica !== 'string') codifica = 'utf8';
    return Buffer.byteLength(blocco, codifica);
  }
  if (ArrayBuffer.isView(blocco)) return blocco.byteLength;
  return 0;
}

// Tutti i dati rimangono in memoria: nessuna scrittura su disco a ogni richiesta.
function creaDiagnosticaRete(opzioni = {}) {
  const orologio = opzioni.orologio || Date.now;
  const cronometro = opzioni.cronometro || misuraTempo;
  const avvio = new Date(orologio());
  const percorsi = new Map();
  const log = new Array(MAX_RICHIESTE_LOG);
  const trend = new Array(MINUTI_TREND);
  let ultimoId = 0;
  let richiesteAvviate = 0;
  let inCorso = 0;
  let piccoInCorso = 0;

  function aggiornaPercorso(richiesta) {
    let chiave = richiesta.metodo + ' ' + richiesta.percorso;
    if (!percorsi.has(chiave) && percorsi.size >= MAX_PERCORSI) chiave = 'altre';

    if (!percorsi.has(chiave)) {
      percorsi.set(chiave, {
        percorso: chiave,
        richieste: 0,
        errori: 0,
        interrotte: 0,
        nonModificate: 0,
        byteCorpoRisposta: 0,
        durataTotaleMs: 0,
        durataMaxMs: 0
      });
    }
    const voce = percorsi.get(chiave);
    voce.richieste++;
    voce.byteCorpoRisposta += richiesta.byteCorpoRisposta;
    voce.durataTotaleMs += richiesta.durataMs;
    voce.durataMaxMs = Math.max(voce.durataMaxMs, richiesta.durataMs);
    if (richiesta.stato >= 400) voce.errori++;
    if (richiesta.interrotta) voce.interrotte++;
    if (richiesta.stato === 304) voce.nonModificate++;
  }

  function aggiornaMinuto(richiesta) {
    const minuto = Math.floor(orologio() / MINUTO_MS);
    // Dopo 30 minuti riutilizziamo la prima casella, mantenendo la memoria limitata.
    const posizione = minuto % MINUTI_TREND;
    if (!trend[posizione] || trend[posizione].minuto !== minuto) {
      trend[posizione] = {
        minuto: minuto,
        richieste: 0,
        byteCorpoRisposta: 0,
        durataTotaleMs: 0,
        durataMaxMs: 0,
        errori: 0
      };
    }
    const voce = trend[posizione];
    voce.richieste++;
    voce.byteCorpoRisposta += richiesta.byteCorpoRisposta;
    voce.durataTotaleMs += richiesta.durataMs;
    voce.durataMaxMs = Math.max(voce.durataMaxMs, richiesta.durataMs);
    if (richiesta.stato >= 400) voce.errori++;
  }

  function salvaNelLog(richiesta) {
    // Dopo 500 richieste sovrascriviamo la piu vecchia, senza spostare tutto l'elenco.
    const posizione = ultimoId % MAX_RICHIESTE_LOG;
    ultimoId++;
    richiesta.id = ultimoId;
    richiesta.durataMs = arrotonda(richiesta.durataMs);
    log[posizione] = richiesta;
  }

  function middleware(req, res, next) {
    // La pagina di diagnostica non deve misurare le proprie chiamate di controllo.
    if (req.path === '/api/diagnostica/rete') return next();

    const inizio = cronometro();
    const orario = new Date(orologio()).toISOString();
    richiesteAvviate++;
    inCorso++;
    piccoInCorso = Math.max(piccoInCorso, inCorso);
    let byteProdotti = 0;
    let registrata = false;

    // Servono entrambi: Express invia spesso tutto con end, i download usano write.
    const scriviOriginale = res.write;
    const terminaOriginale = res.end;
    res.write = function (blocco, codifica, ...argomenti) {
      byteProdotti += dimensioneBlocco(blocco, codifica);
      return scriviOriginale.call(this, blocco, codifica, ...argomenti);
    };
    res.end = function (blocco, codifica, ...argomenti) {
      byteProdotti += dimensioneBlocco(blocco, codifica);
      return terminaOriginale.call(this, blocco, codifica, ...argomenti);
    };

    function registra(interrotta) {
      // finish e close possono arrivare entrambi: la richiesta va contata una sola volta.
      if (registrata) return;
      registrata = true;
      inCorso--;

      let percorso = req.path;
      if (req.route && typeof req.route.path === 'string') percorso = req.route.path;
      else if (percorso.startsWith('/api/')) percorso = '/api/*';
      percorso = percorso.slice(0, 500);

      let reparto = '';
      if (percorso === '/api/stato' && getReparto(req.query?.reparto)) reparto = req.query.reparto;
      let ip = '';
      if (req.socket) ip = req.socket.remoteAddress || '';
      ip = ip.replace(/^::ffff:/, '').slice(0, 64);

      // Questi esiti non contengono il corpo della risposta.
      if (req.method === 'HEAD' || res.statusCode === 204 || res.statusCode === 304) byteProdotti = 0;
      // Il cronometro usa nanosecondi; l'interfaccia mostra millisecondi.
      const durata = Math.max(0, Number(cronometro() - inizio) / 1000000);
      const richiesta = {
        orario: orario,
        ip: ip,
        metodo: req.method,
        percorso: percorso,
        reparto: reparto,
        stato: res.statusCode,
        durataMs: durata,
        byteCorpoRisposta: byteProdotti,
        interrotta: interrotta
      };
      aggiornaPercorso(richiesta);
      aggiornaMinuto(richiesta);
      salvaNelLog(richiesta);
    }
    res.once('finish', function () { registra(false); });
    res.once('close', function () { registra(!res.writableFinished); });
    next();
  }

  function leggiTrend(adesso) {
    const minutoCorrente = Math.floor(adesso / MINUTO_MS);
    const minutoAvvio = Math.floor(avvio.getTime() / MINUTO_MS);
    const primoMinuto = Math.max(minutoAvvio, minutoCorrente - MINUTI_TREND + 1);
    const campioni = [];

    for (let minuto = primoMinuto; minuto <= minutoCorrente; minuto++) {
      let voce = trend[minuto % MINUTI_TREND];
      if (!voce || voce.minuto !== minuto) {
        voce = { richieste: 0, byteCorpoRisposta: 0, durataTotaleMs: 0, durataMaxMs: 0, errori: 0 };
      }
      let media = 0;
      if (voce.richieste > 0) media = voce.durataTotaleMs / voce.richieste;
      const inizioMinuto = minuto * MINUTO_MS;
      campioni.push({
        inizio: new Date(inizioMinuto).toISOString(),
        parziale: inizioMinuto < avvio.getTime() || inizioMinuto + MINUTO_MS > adesso,
        richieste: voce.richieste,
        byteCorpoRisposta: voce.byteCorpoRisposta,
        durataMediaMs: arrotonda(media),
        durataMaxMs: arrotonda(voce.durataMaxMs),
        errori: voce.errori
      });
    }
    return { intervalloMs: MINUTO_MS, minuti: MINUTI_TREND, campioni: campioni };
  }

  function leggiLog(dopo, avvioRichiesto) {
    const primoId = Math.max(1, ultimoId - MAX_RICHIESTE_LOG + 1);
    const altroAvvio = avvioRichiesto !== undefined && avvioRichiesto !== avvio.toISOString();
    const cursoreNonValido = dopo === undefined || dopo > ultimoId || dopo < primoId - 1;
    const logCompleto = altroAvvio || cursoreNonValido;
    const richiesteRecenti = [];

    for (let id = ultimoId; id >= primoId; id--) {
      if (!logCompleto && id <= dopo) break;
      const richiesta = log[(id - 1) % MAX_RICHIESTE_LOG];
      richiesteRecenti.push({ ...richiesta });
    }
    return { logCompleto: logCompleto, richiesteRecenti: richiesteRecenti };
  }

  function statistiche(filtri = {}) {
    const adesso = orologio();
    const logRisposta = leggiLog(filtri.dopo, filtri.avvioRichiesto);
    const riepilogoPercorsi = [];

    for (const voce of percorsi.values()) {
      riepilogoPercorsi.push({
        percorso: voce.percorso,
        richieste: voce.richieste,
        errori: voce.errori,
        interrotte: voce.interrotte,
        nonModificate: voce.nonModificate,
        byteCorpoRisposta: voce.byteCorpoRisposta,
        durataMediaMs: arrotonda(voce.durataTotaleMs / voce.richieste),
        durataMaxMs: arrotonda(voce.durataMaxMs)
      });
    }
    riepilogoPercorsi.sort(function (prima, seconda) {
      return seconda.byteCorpoRisposta - prima.byteCorpoRisposta;
    });
    return {
      avvio: avvio.toISOString(),
      secondiOsservati: arrotonda((adesso - avvio.getTime()) / 1000),
      richiesteAvviate: richiesteAvviate,
      inCorso: inCorso,
      piccoInCorso: piccoInCorso,
      limiteLog: MAX_RICHIESTE_LOG,
      ultimoId: ultimoId,
      logCompleto: logRisposta.logCompleto,
      richiesteRecenti: logRisposta.richiesteRecenti,
      trend: leggiTrend(adesso),
      misuraByte: 'Corpo delle risposte applicative, esclusi header e overhead TCP/TLS; per le interruzioni conta i byte prodotti prima della chiusura.',
      percorsi: riepilogoPercorsi
    };
  }
  return { middleware: middleware, statistiche: statistiche };
}

module.exports = { creaDiagnosticaRete: creaDiagnosticaRete };
