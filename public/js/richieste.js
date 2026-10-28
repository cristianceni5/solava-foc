// Diagnostica delle richieste: dati in memoria, poi disegno della sola vista aperta.

// Tempi e limiti modificabili.
const AGGIORNAMENTO_MS = 15000;
const TIMEOUT_RICHIESTA_MS = 10000;
const MAX_LOG_SALVATI = 500;
const IP_PER_PAGINA = 25;
const RICHIESTA_LENTA_MS = 1000;
const RISPOSTA_PESANTE_BYTE = 1024 * 1024;

// I campi hanno gli stessi nomi per computer, percorsi e minuti del trend.
const METRICHE_RICHIESTE = {
    richieste: { nome: 'Numero di richieste', campo: 'richieste', colonnaIp: 1, colonnaPercorso: 1 },
    traffico: { nome: 'Traffico delle risposte', campo: 'byteCorpoRisposta', colonnaIp: 9, colonnaPercorso: 2 },
    tempo: { nome: 'Tempo medio', campo: 'durataMediaMs', colonnaIp: 7, colonnaPercorso: 3 },
    errori: { nome: 'Errori HTTP', campo: 'errori', colonnaIp: 5, colonnaPercorso: 5 }
};

let datiDiagnostica = null;
let richiesteRecenti = [];
let computerRaggruppati = [];
let ultimoIdRicevuto;
let avvioServizio;
let metricaScelta = 'richieste';
let numeroPagina = 1;
let caricamentoInCorso = false;
let sessioneScaduta = false;
let erroriConsecutivi = 0;
let timerAggiornamento;
let minutoSelezionato;
let pulsantiTrend = [];
const percorsiAperti = new Set();

function elementoRichieste(nome) {
    return document.getElementById('richieste-' + nome);
}

function formattaNumero(valore) {
    return Number(valore || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

function formattaByte(valore) {
    let quantita = Number(valore || 0);
    const unita = ['B', 'KiB', 'MiB', 'GiB'];
    let indiceUnita = 0;

    while (quantita >= 1024 && indiceUnita < unita.length - 1) {
        quantita = quantita / 1024;
        indiceUnita++;
    }
    return formattaNumero(quantita) + ' ' + unita[indiceUnita];
}

function formattaDurata(millisecondi) {
    if (millisecondi >= 1000) {
        return formattaNumero(millisecondi / 1000) + ' s';
    }
    return formattaNumero(millisecondi) + ' ms';
}

function formattaOra(data) {
    return new Date(data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function valoreMetrica(voce) {
    const campo = METRICHE_RICHIESTE[metricaScelta].campo;
    return voce[campo] || 0;
}

function formattaMetrica(valore) {
    if (metricaScelta === 'traffico') return formattaByte(valore);
    if (metricaScelta === 'tempo') return formattaDurata(valore);

    let unita = 'richieste';
    if (valore === 1) unita = 'richiesta';
    if (metricaScelta === 'errori') {
        unita = 'errori';
        if (valore === 1) unita = 'errore';
    }
    return formattaNumero(valore) + ' ' + unita;
}

function ordinaPerMetrica(elenco) {
    const copia = elenco.slice();
    copia.sort(function (prima, seconda) {
        return valoreMetrica(seconda) - valoreMetrica(prima);
    });
    return copia;
}

// Arrivano solo le righe nuove. Se il server riparte, sostituiamo il vecchio log.
function aggiornaRichiesteSalvate(dati, servizioRiavviato) {
    if (!dati.logCompleto && !servizioRiavviato && dati.richiesteRecenti.length === 0) return;

    const richiestePerId = new Map();
    for (const richiesta of dati.richiesteRecenti) {
        richiestePerId.set(richiesta.id, richiesta);
    }
    if (!dati.logCompleto && !servizioRiavviato) {
        for (const richiesta of richiesteRecenti) {
            if (!richiestePerId.has(richiesta.id)) {
                richiestePerId.set(richiesta.id, richiesta);
            }
        }
    }
    richiesteRecenti = Array.from(richiestePerId.values());
    richiesteRecenti.sort(function (prima, seconda) {
        return seconda.id - prima.id;
    });
    richiesteRecenti = richiesteRecenti.slice(0, MAX_LOG_SALVATI);
    raggruppaComputer();
}

// Il riepilogo per IP si calcola una volta quando cambia il log, non a ogni filtro.
function raggruppaComputer() {
    const computerPerIp = new Map();

    for (const richiesta of richiesteRecenti) {
        const ip = richiesta.ip || '—';
        if (!computerPerIp.has(ip)) {
            computerPerIp.set(ip, {
                ip: ip,
                ultimoContatto: richiesta.orario,
                richieste: 0,
                byteCorpoRisposta: 0,
                byteMax: 0,
                durataTotaleMs: 0,
                durataMediaMs: 0,
                durataMaxMs: 0,
                errori: 0,
                interrotte: 0,
                percorsi: new Map(),
                reparti: new Set(),
                esiti: new Set()
            });
        }

        const computer = computerPerIp.get(ip);
        if (richiesta.orario > computer.ultimoContatto) {
            computer.ultimoContatto = richiesta.orario;
        }
        computer.richieste++;
        computer.byteCorpoRisposta += richiesta.byteCorpoRisposta;
        computer.byteMax = Math.max(computer.byteMax, richiesta.byteCorpoRisposta);
        computer.durataTotaleMs += richiesta.durataMs;
        computer.durataMaxMs = Math.max(computer.durataMaxMs, richiesta.durataMs);
        if (richiesta.stato >= 400) computer.errori++;
        if (richiesta.interrotta) computer.interrotte++;
        if (richiesta.reparto) computer.reparti.add(richiesta.reparto);
        computer.esiti.add(richiesta.stato);

        const percorso = richiesta.metodo + ' ' + richiesta.percorso;
        const conteggioPrecedente = computer.percorsi.get(percorso) || 0;
        computer.percorsi.set(percorso, conteggioPrecedente + 1);
    }

    computerRaggruppati = Array.from(computerPerIp.values());
    for (const computer of computerRaggruppati) {
        computer.durataMediaMs = computer.durataTotaleMs / computer.richieste;
        computer.testoRicerca = [
            computer.ip,
            Array.from(computer.percorsi.keys()).join(' '),
            Array.from(computer.reparti).join(' '),
            Array.from(computer.esiti).join(' ')
        ].join(' ').toLowerCase();
    }
    for (const ip of percorsiAperti) {
        if (!computerPerIp.has(ip)) percorsiAperti.delete(ip);
    }
}

function vistaLogAperta() {
    return window.location.hash === '#log';
}

function cambiaVista(scorri) {
    const mostraLog = vistaLogAperta();
    elementoRichieste('vista-riepilogo').hidden = mostraLog;
    elementoRichieste('vista-log').hidden = !mostraLog;
    elementoRichieste('tab-riepilogo').setAttribute('aria-current', mostraLog ? 'false' : 'page');
    elementoRichieste('tab-log').setAttribute('aria-current', mostraLog ? 'page' : 'false');
    aggiornaVistaAperta();
    if (scorri) elementoRichieste('viste').scrollIntoView({ block: 'start' });
}

// Le tabelle nascoste non vengono ricostruite durante il polling.
function aggiornaVistaAperta() {
    if (!datiDiagnostica) return;

    if (vistaLogAperta()) {
        mostraTotaliServizio();
        mostraTabellaComputer();
        return;
    }
    mostraSintesiPeriodo();
    mostraTrend();
    mostraComputerPrincipali();
}

function mostraSintesiPeriodo() {
    const campioni = datiDiagnostica.trend?.campioni || [];
    let voci = datiDiagnostica.percorsi;
    if (campioni.length > 0) voci = campioni;

    let totaleRichieste = 0;
    let totaleByte = 0;
    let totaleErrori = 0;
    for (const voce of voci) {
        totaleRichieste += voce.richieste;
        totaleByte += voce.byteCorpoRisposta;
        totaleErrori += voce.errori;
    }
    elementoRichieste('sintesi-totale').textContent = formattaNumero(totaleRichieste);
    elementoRichieste('sintesi-byte').textContent = formattaByte(totaleByte);
    elementoRichieste('sintesi-errori').textContent = formattaNumero(totaleErrori);
    elementoRichieste('sintesi-errori').className = '';
    if (totaleErrori > 0) elementoRichieste('sintesi-errori').className = 'richieste-sintesi-errori';

    let periodo = 'Dall’avvio del servizio';
    if (campioni.length > 0) periodo = 'Dalle ' + formattaOra(campioni[0].inizio) + ' · tutti i computer';
    elementoRichieste('sintesi-periodo').textContent = periodo;
}

function creaRigaTabella(valori) {
    const riga = document.createElement('tr');
    for (const valore of valori) {
        const cella = document.createElement('td');
        cella.textContent = valore;
        riga.append(cella);
    }
    return riga;
}

function mostraTabellaVuota(contenitore, colonne, messaggio) {
    const riga = creaRigaTabella([messaggio]);
    riga.children[0].colSpan = colonne;
    riga.children[0].className = 'richiesta-vuota';
    contenitore.replaceChildren(riga);
}

function evidenziaMassimo(riga, colonna, voce) {
    if (valoreMetrica(voce) <= 0) return;
    const cella = riga.children[colonna];
    cella.className = (cella.className || '') + ' richiesta-picco-valore';
    cella.title = 'Massimo per ' + METRICHE_RICHIESTE[metricaScelta].nome.toLowerCase()
        + ': ' + formattaMetrica(valoreMetrica(voce));
}

function creaDettaglioPercorsi(computer) {
    const dettagli = document.createElement('details');
    dettagli.className = 'richieste-percorsi-ip';
    dettagli.open = percorsiAperti.has(computer.ip);
    dettagli.addEventListener('toggle', function () {
        if (dettagli.open) percorsiAperti.add(computer.ip);
        else percorsiAperti.delete(computer.ip);
    });

    const titolo = document.createElement('summary');
    const icona = document.createElement('i');
    icona.className = 'fa-solid fa-chevron-right richieste-freccia';
    icona.setAttribute('aria-hidden', 'true');
    const etichetta = document.createElement('span');
    let parola = 'percorsi';
    if (computer.percorsi.size === 1) parola = 'percorso';
    etichetta.textContent = formattaNumero(computer.percorsi.size) + ' ' + parola;
    titolo.append(icona);
    titolo.append(etichetta);

    const percorsi = Array.from(computer.percorsi.entries());
    percorsi.sort(function (prima, seconda) {
        if (prima[1] !== seconda[1]) return seconda[1] - prima[1];
        return prima[0].localeCompare(seconda[0]);
    });
    const elenco = document.createElement('ul');
    for (const percorso of percorsi) {
        const voce = document.createElement('li');
        let unita = 'richieste';
        if (percorso[1] === 1) unita = 'richiesta';
        voce.textContent = percorso[0] + ' · ' + formattaNumero(percorso[1]) + ' ' + unita;
        elenco.append(voce);
    }
    dettagli.append(titolo);
    dettagli.append(elenco);
    return dettagli;
}

function creaRigaComputer(computer) {
    const riga = creaRigaTabella([
        computer.ip,
        formattaNumero(computer.richieste),
        new Date(computer.ultimoContatto).toLocaleString('it-IT'),
        '',
        Array.from(computer.reparti).join(', ') || '—',
        formattaNumero(computer.errori),
        formattaNumero(computer.interrotte),
        formattaDurata(computer.durataMediaMs),
        formattaDurata(computer.durataMaxMs),
        formattaByte(computer.byteCorpoRisposta)
    ]);
    riga.children[3].append(creaDettaglioPercorsi(computer));
    if (computer.errori > 0) riga.children[5].className = 'richiesta-errore';
    if (computer.interrotte > 0) riga.children[6].className = 'richiesta-attenzione';
    if (computer.durataMaxMs >= RICHIESTA_LENTA_MS) riga.children[8].className = 'richiesta-attenzione';
    if (computer.byteMax >= RISPOSTA_PESANTE_BYTE) riga.children[9].className = 'richiesta-attenzione';
    return riga;
}

function computerCorrispondeAlFiltro(computer, cerca, filtro) {
    if (!computer.testoRicerca.includes(cerca)) return false;

    switch (filtro) {
        case 'errori': return computer.errori > 0;
        case 'lente': return computer.durataMaxMs >= RICHIESTA_LENTA_MS;
        case 'pesanti': return computer.byteMax >= RISPOSTA_PESANTE_BYTE;
        case 'interrotte': return computer.interrotte > 0;
        default: return true;
    }
}

function mostraTabellaComputer() {
    const cerca = elementoRichieste('cerca').value.trim().toLowerCase();
    const filtro = elementoRichieste('filtro').value;
    const computerFiltrati = [];
    for (const computer of computerRaggruppati) {
        if (computerCorrispondeAlFiltro(computer, cerca, filtro)) computerFiltrati.push(computer);
    }
    const computerOrdinati = ordinaPerMetrica(computerFiltrati);
    const pagine = Math.max(1, Math.ceil(computerOrdinati.length / IP_PER_PAGINA));
    numeroPagina = Math.max(1, Math.min(numeroPagina, pagine));
    const inizio = (numeroPagina - 1) * IP_PER_PAGINA;
    const computerVisibili = computerOrdinati.slice(inizio, inizio + IP_PER_PAGINA);
    const righe = [];

    for (const computer of computerVisibili) {
        const riga = creaRigaComputer(computer);
        if (computer === computerOrdinati[0]) {
            evidenziaMassimo(riga, METRICHE_RICHIESTE[metricaScelta].colonnaIp, computer);
        }
        righe.push(riga);
    }
    if (righe.length > 0) {
        elementoRichieste('log').replaceChildren(...righe);
    } else {
        let messaggio = 'Nessuna richiesta conclusa disponibile.';
        if (richiesteRecenti.length > 0) messaggio = 'Nessun IP corrisponde ai filtri.';
        mostraTabellaVuota(elementoRichieste('log'), 10, messaggio);
    }

    let totaleRichieste = 0;
    for (const computer of computerFiltrati) totaleRichieste += computer.richieste;
    elementoRichieste('pagina').textContent = 'Pagina ' + numeroPagina + ' di ' + pagine;
    elementoRichieste('precedente').disabled = numeroPagina === 1;
    elementoRichieste('successiva').disabled = numeroPagina === pagine;
    elementoRichieste('conteggio').textContent = formattaNumero(computerFiltrati.length) + ' IP · '
        + formattaNumero(totaleRichieste) + ' richieste aggregate · '
        + formattaNumero(richiesteRecenti.length) + ' richieste nel log';
}

function mostraTotaliServizio() {
    const percorsi = ordinaPerMetrica(datiDiagnostica.percorsi);
    let richiesteConcluse = 0;
    let tempoTotale = 0;
    let byteTotali = 0;
    let erroriTotali = 0;
    let interruzioniTotali = 0;
    let durataMassima = 0;
    const righe = [];

    for (const percorso of percorsi) {
        richiesteConcluse += percorso.richieste;
        tempoTotale += percorso.durataMediaMs * percorso.richieste;
        byteTotali += percorso.byteCorpoRisposta;
        erroriTotali += percorso.errori;
        interruzioniTotali += percorso.interrotte;
        durataMassima = Math.max(durataMassima, percorso.durataMaxMs);

        const riga = creaRigaTabella([
            percorso.percorso, formattaNumero(percorso.richieste), formattaByte(percorso.byteCorpoRisposta),
            formattaDurata(percorso.durataMediaMs), formattaDurata(percorso.durataMaxMs),
            formattaNumero(percorso.errori), formattaNumero(percorso.nonModificate)
        ]);
        riga.children[0].className = 'richiesta-percorso';
        if (percorso.durataMediaMs >= RICHIESTA_LENTA_MS) riga.children[3].className = 'richiesta-attenzione';
        if (percorso.durataMaxMs >= RICHIESTA_LENTA_MS) riga.children[4].className = 'richiesta-attenzione';
        if (percorso.errori > 0) riga.children[5].className = 'richiesta-errore';
        if (righe.length === 0) {
            evidenziaMassimo(riga, METRICHE_RICHIESTE[metricaScelta].colonnaPercorso, percorso);
        }
        righe.push(riga);
    }
    let durataMedia = 0;
    if (richiesteConcluse > 0) durataMedia = tempoTotale / richiesteConcluse;
    elementoRichieste('avvio').textContent = 'Contatori dal ' + new Date(datiDiagnostica.avvio).toLocaleString('it-IT');
    elementoRichieste('totale').textContent = formattaNumero(datiDiagnostica.richiesteAvviate);
    elementoRichieste('concorrenza').textContent = formattaNumero(datiDiagnostica.inCorso)
        + ' in corso · picco ' + formattaNumero(datiDiagnostica.piccoInCorso);
    elementoRichieste('byte').textContent = formattaByte(byteTotali);
    elementoRichieste('tempo').textContent = formattaDurata(durataMedia);
    elementoRichieste('tempo-max').textContent = 'Massimo ' + formattaDurata(durataMassima);
    elementoRichieste('errori').textContent = formattaNumero(erroriTotali);
    elementoRichieste('interrotte').textContent = formattaNumero(interruzioniTotali) + ' interrotte';
    elementoRichieste('classifiche-nota').textContent = 'Ordine: '
        + METRICHE_RICHIESTE[metricaScelta].nome.toLowerCase()
        + '. Dati dall’avvio del servizio; include API, pagine e download.';

    if (righe.length > 0) elementoRichieste('percorsi').replaceChildren(...righe);
    else mostraTabellaVuota(elementoRichieste('percorsi'), 7, 'Nessun percorso disponibile.');

    const sql = datiDiagnostica.monitorReparti || {};
    let mediaSql = 0;
    if (sql.lettureSql > 0) mediaSql = sql.durataTotaleSqlMs / sql.lettureSql;
    elementoRichieste('sql-query').textContent = formattaNumero(sql.lettureSql);
    elementoRichieste('sql-cache').textContent = formattaNumero(sql.risposteCache);
    elementoRichieste('sql-accorpate').textContent = formattaNumero(sql.richiesteAccorpate);
    elementoRichieste('sql-errori').textContent = formattaNumero(sql.erroriSql);
    elementoRichieste('sql-tempi').textContent = 'Tempo SQL medio ' + formattaDurata(mediaSql)
        + ' · massimo ' + formattaDurata(sql.durataMaxSqlMs || 0);
}

function mostraComputerPrincipali() {
    const computerOrdinati = ordinaPerMetrica(computerRaggruppati);
    const righe = [];
    for (const computer of computerOrdinati) {
        if (righe.length === 3) break;
        if (valoreMetrica(computer) <= 0) continue;

        const riga = document.createElement('li');
        if (righe.length === 0) riga.className = 'richieste-classifica-prima';
        const nome = document.createElement('span');
        nome.className = 'richieste-classifica-nome';
        nome.textContent = computer.ip;
        const valore = document.createElement('span');
        valore.className = 'richieste-classifica-valore';
        valore.textContent = formattaMetrica(valoreMetrica(computer));
        riga.append(nome);
        riga.append(valore);
        righe.push(riga);
    }
    if (righe.length === 0) {
        const vuoto = document.createElement('li');
        vuoto.className = 'richieste-classifica-vuota';
        vuoto.textContent = 'Nessuna attività da mostrare.';
        if (metricaScelta === 'errori') vuoto.textContent = 'Nessun errore nei dati disponibili.';
        righe.push(vuoto);
    }
    elementoRichieste('top-ip').replaceChildren(...righe);
}

function selezionaMinuto(campione) {
    minutoSelezionato = campione.inizio;
    for (const minuto of pulsantiTrend) {
        const selezionato = minuto.campione.inizio === campione.inizio;
        minuto.pulsante.setAttribute('aria-pressed', String(selezionato));
    }
    let testo = formattaOra(campione.inizio) + ' · ' + formattaMetrica(valoreMetrica(campione));
    if (campione.parziale) testo += ' (intervallo parziale)';
    elementoRichieste('trend-dettaglio').textContent = testo;
}

function creaPulsanteMinuto(campione, massimo) {
    const valore = valoreMetrica(campione);
    const pulsante = document.createElement('button');
    pulsante.type = 'button';
    pulsante.dataset.minutoTrend = campione.inizio;
    pulsante.className = 'richieste-trend-minuto';
    if (massimo > 0 && valore === massimo) pulsante.className += ' richieste-trend-minuto-picco';
    pulsante.title = formattaOra(campione.inizio) + ': ' + formattaMetrica(valore);
    if (campione.parziale) pulsante.title += ' (intervallo parziale)';
    pulsante.setAttribute('aria-label', pulsante.title);
    pulsante.addEventListener('click', function () {
        selezionaMinuto(campione);
    });

    let altezza = 0;
    if (massimo > 0) altezza = valore / massimo * 100;
    const barra = document.createElement('span');
    barra.className = 'richieste-trend-barra';
    barra.style.height = altezza + '%';
    pulsante.append(barra);
    return pulsante;
}

function mostraTrend() {
    const campioni = datiDiagnostica.trend?.campioni || [];
    const minutoConFocus = document.activeElement?.dataset?.minutoTrend;
    let massimo = 0;
    let picco;
    let campioneSelezionato;

    for (const campione of campioni) {
        if (valoreMetrica(campione) > massimo) {
            massimo = valoreMetrica(campione);
            picco = campione;
        }
        if (campione.inizio === minutoSelezionato) campioneSelezionato = campione;
    }
    let descrizione = 'Nessuna attività nel periodo.';
    if (metricaScelta === 'errori') descrizione = 'Nessun errore nel periodo.';
    if (picco) descrizione = 'Picco ' + formattaMetrica(massimo) + ' alle ' + formattaOra(picco.inizio);
    if (campioni.length === 0) descrizione = 'Trend non disponibile: riavvia il servizio per attivare la raccolta al minuto.';
    elementoRichieste('trend-picco').textContent = descrizione;

    const pulsanti = [];
    pulsantiTrend = [];
    for (const campione of campioni) {
        const pulsante = creaPulsanteMinuto(campione, massimo);
        pulsanti.push(pulsante);
        pulsantiTrend.push({ pulsante: pulsante, campione: campione });
    }
    elementoRichieste('trend-grafico').style.gridTemplateColumns =
        'repeat(' + Math.max(1, campioni.length) + ', minmax(16px, 1fr))';
    elementoRichieste('trend-grafico').replaceChildren(...pulsanti);
    elementoRichieste('trend-inizio').textContent = '';
    elementoRichieste('trend-fine').textContent = '';

    if (campioni.length > 0) {
        elementoRichieste('trend-inizio').textContent = formattaOra(campioni[0].inizio);
        elementoRichieste('trend-fine').textContent = formattaOra(campioni[campioni.length - 1].inizio);
        if (!campioneSelezionato) campioneSelezionato = picco || campioni[campioni.length - 1];
        selezionaMinuto(campioneSelezionato);
    } else {
        elementoRichieste('trend-dettaglio').textContent = 'I dati saranno disponibili dopo l’attivazione della raccolta.';
    }
    for (const minuto of pulsantiTrend) {
        if (minuto.campione.inizio === minutoConFocus) minuto.pulsante.focus({ preventScroll: true });
    }
}

function programmaAggiornamento() {
    clearTimeout(timerAggiornamento);
    if (!elementoRichieste('auto').checked || document.hidden || sessioneScaduta) return;

    let attesa = AGGIORNAMENTO_MS;
    if (erroriConsecutivi === 1) attesa = 30000;
    if (erroriConsecutivi === 2) attesa = 60000;
    if (erroriConsecutivi >= 3) attesa = 120000;
    timerAggiornamento = setTimeout(caricaRichieste, attesa);
}

async function caricaRichieste() {
    if (caricamentoInCorso || document.hidden || sessioneScaduta) return;
    clearTimeout(timerAggiornamento);
    caricamentoInCorso = true;
    elementoRichieste('aggiorna').disabled = true;

    try {
        let indirizzo = '/api/diagnostica/rete';
        if (ultimoIdRicevuto !== undefined) {
            indirizzo += '?dopo=' + ultimoIdRicevuto + '&avvio=' + encodeURIComponent(avvioServizio);
        }
        const risposta = await fetch(indirizzo, {
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_RICHIESTA_MS)
        });
        if (risposta.status === 401) {
            sessioneScaduta = true;
            window.location.assign('/autenticazione.html?ritorno=' + encodeURIComponent('/paginaRichieste.html'));
            return;
        }
        const dati = await risposta.json();
        if (!risposta.ok) throw new Error(dati.errore || 'Diagnostica non disponibile');
        if (!Array.isArray(dati.percorsi) || !Array.isArray(dati.richiesteRecenti)
            || !Number.isSafeInteger(dati.ultimoId)) {
            throw new Error('Formato dei log non valido');
        }

        const servizioRiavviato = avvioServizio !== undefined && avvioServizio !== dati.avvio;
        aggiornaRichiesteSalvate(dati, servizioRiavviato);
        if (servizioRiavviato) {
            numeroPagina = 1;
            minutoSelezionato = undefined;
        }
        ultimoIdRicevuto = dati.ultimoId;
        avvioServizio = dati.avvio;
        datiDiagnostica = dati;
        aggiornaVistaAperta();
        erroriConsecutivi = 0;
        elementoRichieste('stato').className = '';
        elementoRichieste('stato').textContent = '';
        if (servizioRiavviato) elementoRichieste('stato').textContent = 'Servizio riavviato: log e contatori sono ripartiti.';
        elementoRichieste('aggiornamento').textContent = 'Ultimo aggiornamento: ' + new Date().toLocaleTimeString('it-IT');
    } catch (errore) {
        erroriConsecutivi++;
        elementoRichieste('stato').className = 'errore';
        let messaggio = errore.message || 'Impossibile caricare i dati';
        if (datiDiagnostica) messaggio += '. Restano visibili i dati del precedente aggiornamento.';
        elementoRichieste('stato').textContent = messaggio + ' Usa Aggiorna per riprovare.';
    } finally {
        caricamentoInCorso = false;
        elementoRichieste('aggiorna').disabled = false;
        programmaAggiornamento();
    }
}

function cambiaMetrica(scelta) {
    if (!METRICHE_RICHIESTE[scelta]) scelta = 'richieste';
    metricaScelta = scelta;
    elementoRichieste('metrica').value = scelta;
    elementoRichieste('metrica-log').value = scelta;
    numeroPagina = 1;
    aggiornaVistaAperta();
}

function cambiaFiltro() {
    numeroPagina = 1;
    if (datiDiagnostica && vistaLogAperta()) mostraTabellaComputer();
}

function cambiaVisibilita() {
    clearTimeout(timerAggiornamento);
    if (!document.hidden && elementoRichieste('auto').checked) caricaRichieste();
}

// Collegamenti dei controlli. Cambiare vista o filtro non scarica nuovi dati.
elementoRichieste('aggiorna').addEventListener('click', caricaRichieste);
elementoRichieste('auto').addEventListener('change', function () {
    clearTimeout(timerAggiornamento);
    if (elementoRichieste('auto').checked) caricaRichieste();
});
elementoRichieste('metrica').addEventListener('change', function () {
    cambiaMetrica(elementoRichieste('metrica').value);
});
elementoRichieste('metrica-log').addEventListener('change', function () {
    cambiaMetrica(elementoRichieste('metrica-log').value);
});
elementoRichieste('cerca').addEventListener('input', cambiaFiltro);
elementoRichieste('filtro').addEventListener('change', cambiaFiltro);
elementoRichieste('precedente').addEventListener('click', function () {
    numeroPagina--;
    mostraTabellaComputer();
});
elementoRichieste('successiva').addEventListener('click', function () {
    numeroPagina++;
    mostraTabellaComputer();
});
document.addEventListener('visibilitychange', cambiaVisibilita);
window.addEventListener('hashchange', function () {
    cambiaVista(true);
});

cambiaVista(false);
caricaRichieste();
