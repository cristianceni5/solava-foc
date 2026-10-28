// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: mostrare il monitor reparto mantenendo il titolo richiesto dal servizio di riapertura.

// Tempo in secondi tra un aggiornamento completato e il successivo.
const OGNI_QUANTO_RICARICA = 15;
const INTERVALLO_REFRESH_MS = OGNI_QUANTO_RICARICA * 1000;
const LUNGHEZZA_MAX_DESCRIZIONE = 25;
// Colonne nascoste nella tabella principale ma chiamate nella query, sicchè modificare qui per altre colonne.
const COLONNE_NASCOSTE = new Set(['OPERATORE', 'STATO', 'QTA ORD', 'QTA GG']);
const params = new URLSearchParams(window.location.search);
const reparto = params.get('reparto');
let refreshTimer;
let ultimoAggiornamentoRiuscito = null;
let caricamentoStato = false;
let ultimaRisposta = null;
let etagStato = null;
let erroriConsecutivi = 0;
let repartoNonValido = false;
// Colonne che fisso quando il DB risponde con nessuna riga, non hanno un significato reale le ho messe per coerenza con la risposta del DB
const COLONNE_FISSE_DALLA_QUERY = ['IMPIANTO', 'LOTTO', 'ARTICOLO', 'DESCRIZIONE', 'CODICE OP', 'QTA TOT', 'QTA OP'];

function classeStato(statoRipresa) {
    const mappa = {
        Ripresa: 'stato-bono',
        Lanciata: 'stato-bono',
        Sospesa: 'stato-attenzione',
        Iniziata: 'stato-bono',
        Finita: 'stato-finita',
    };
    return mappa[statoRipresa] ?? 'stato-sconosciuto';
}

// Formattazione dei nomi per renderli più decenti e capibili
function formattaValore(colonna, valore) {
    if (colonna === 'OPERATORE' && valore === 'Operatore non presidiata ') return 'Auto PowerMES';
    if (colonna === 'IMPIANTO' && valore === 'FORNO TERMORETRAIBILE1') return 'Fornino';
    if (colonna === 'IMPIANTO' && valore === 'Termoretraibile1') return 'Etichettatura';
    return valore ?? '—';
}

function apriAnteprima(riga) {
    const dialog = document.getElementById('anteprima-lavorazione');
    const valori = document.getElementById('anteprima-valori');
    valori.innerHTML = '';

    for (const [colonna, valore] of Object.entries(riga)) {
        const campo = document.createElement('div');
        campo.className = 'anteprima-campo';
        const etichetta = document.createElement('dt');
        etichetta.textContent = colonna;
        const contenuto = document.createElement('dd');
        contenuto.textContent = formattaValore(colonna, valore);
        campo.append(etichetta, contenuto);
        valori.appendChild(campo);
    }

    if (dialog.open) dialog.close();
    dialog.showModal();
}

function costruisciTabella(elIntestazione, elCorpo, righe, nomeReparto = '') {
    elIntestazione.innerHTML = '';
    elCorpo.innerHTML = '';

    const colonne = righe.length > 0 ? Object.keys(righe[0]) : COLONNE_FISSE_DALLA_QUERY;
    const colonneVisibili = colonne.filter((colonna) => !COLONNE_NASCOSTE.has(colonna));
    const headRow = document.createElement('tr');
    for (const colonna of colonneVisibili) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = colonna;
        headRow.appendChild(th);
    }
    elIntestazione.appendChild(headRow);

    if (righe.length === 0) {
        const row = elCorpo.insertRow();
        row.classList.add('riga-vuota');
        const cell = row.insertCell();
        cell.colSpan = colonneVisibili.length;
        cell.textContent = 'Nessuna lavorazione disponibile.';
        return;
    }

    for (const riga of righe) {
        const row = elCorpo.insertRow();
        row.classList.add(classeStato(riga.STATO));
        row.classList.add('riga-cliccabile');
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-haspopup', 'dialog');
        row.setAttribute('aria-label', 'Apri il dettaglio completo della lavorazione');
        row.title = 'Apri il dettaglio completo';
        row.addEventListener('click', () => apriAnteprima(riga));
        row.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                apriAnteprima(riga);
            }
        });

        for (const colonna of colonneVisibili) {
            const cell = row.insertCell();
            const valoreCompleto = formattaValore(colonna, riga[colonna]);
            let valore = valoreCompleto;

            if (colonna === 'DESCRIZIONE' && typeof valore === 'string' && valore.length > LUNGHEZZA_MAX_DESCRIZIONE) {
                cell.title = valoreCompleto;
                valore = `${valore.slice(0, LUNGHEZZA_MAX_DESCRIZIONE)}...`;
            }

            cell.textContent = valore;
            cell.dataset.label = colonna;
        }
    }
}

const dialogAnteprima = document.getElementById('anteprima-lavorazione');
document.getElementById('chiudi-anteprima').addEventListener('click', () => dialogAnteprima.close());
dialogAnteprima.addEventListener('click', (evento) => {
    if (evento.target === dialogAnteprima) dialogAnteprima.close();
});

function configuraPulsanteCoda() {
    const pulsante = document.getElementById('apri-coda');
    if (reparto !== 'scape' && reparto !== 'slingl') {
        pulsante.style.display = 'none';
        return;
    }
    let macchina = 'Linea1';
    if (reparto === 'scape') macchina = 'Linea2';
    pulsante.style.display = 'inline-block';
    pulsante.onclick = function () {
        window.open('http://10.40.43.105:8001/Monitor?Machine=' + macchina, '_blank', 'width=1024,height=600');
        return false;
    };
}

async function caricaStato() {
    if (caricamentoStato || document.hidden || repartoNonValido) return;
    clearTimeout(refreshTimer);
    const banner = document.getElementById('status-banner');
    const stato = document.getElementById('stato');
    const risposta = document.getElementById('risposta');
    const ultimoAggiornamento = document.getElementById('ultimo-aggiornamento');
    const dettagliErrore = document.getElementById('errore-reparto-dettagli');
    const rawErrore = document.getElementById('errore-reparto-raw');

    function setStato(testo) {
        stato.innerHTML = '';
        stato.appendChild(document.createTextNode(` ${testo}`));
    }

    if (!reparto) {
        banner.className = 'stato-errore';
        setStato('Reparto non specificato');
        risposta.innerHTML = 'Torna alla <a href="index.html#monitor">selezione del reparto</a>.';
        return;
    }

    caricamentoStato = true;
    try {
        const headers = {};
        if (etagStato) headers['If-None-Match'] = etagStato;
        const res = await fetch(`/api/stato?reparto=${encodeURIComponent(reparto)}`, {
            cache: 'no-store', signal: AbortSignal.timeout(10000),
            headers: headers
        });
        const nonModificato = res.status === 304;
        let json;
        if (nonModificato) json = ultimaRisposta;
        else json = await res.json();
        if (!json) throw new Error('Risposta senza dati disponibili');
        if ((!res.ok && !nonModificato) || !json.ok) {
            const errore = new Error(json.errore || 'Errore durante il caricamento');
            errore.erroreRaw = json.erroreRaw;
            errore.tipoErrore = json.tipoErrore;
            throw errore;
        }
        dettagliErrore.hidden = true;
        dettagliErrore.open = false;
        rawErrore.textContent = '';

        const nomeReparto = json.reparto || 'Reparto';
        document.getElementById('nome-reparto-head').textContent = nomeReparto;
        // Il titolo del browser resta fisso: il servizio di riapertura lo usa per riconoscere la finestra.
        if (!Array.isArray(json.dati)) throw new Error('Formato delle lavorazioni non valido');
        if (!nonModificato) {
            ultimaRisposta = json;
            etagStato = res.headers.get('ETag');
        }
        erroriConsecutivi = 0;
        const righe = json.dati;
        const intestazione = document.getElementById('tabella-intestazione');
        const tabella = document.getElementById('tabella-dati');
        const istanteSql = Date.parse(res.headers.get('X-Dati-Aggiornati-Il'));
        ultimoAggiornamentoRiuscito = new Date();
        if (Number.isFinite(istanteSql)) ultimoAggiornamentoRiuscito = new Date(istanteSql);
        ultimoAggiornamento.textContent = `Ultimo aggiornamento: ${ultimoAggiornamentoRiuscito.toLocaleTimeString('it-IT')}`;

        if (righe.length === 0) {
            banner.className = 'stato-vuoto';
            setStato('Nessuna lavorazione');
            risposta.textContent = 'Non risultano lavorazioni aperte in questo reparto, controlla MES.Frontend.';
            if (!nonModificato) costruisciTabella(intestazione, tabella, righe, json.reparto);
        } else {
            banner.className = 'stato-ok';
            setStato('Lavorazioni aggiornate');
            risposta.textContent = '';
            if (!nonModificato) costruisciTabella(intestazione, tabella, righe);
        }
    } catch (errore) {
        erroriConsecutivi++;
        repartoNonValido = errore.tipoErrore === 'reparto_invalido';
        console.error('Errore caricamento reparto:', errore);
        banner.className = 'stato-errore';
        if (repartoNonValido) setStato('Reparto non valido');
        else setStato('Dati non aggiornati');

        if (errore.name === 'TimeoutError') {
            risposta.textContent = 'Il server non ha risposto entro 10 secondi. Nuovo tentativo automatico.';
        } else if (errore instanceof SyntaxError) {
            risposta.textContent = 'Il server ha restituito una risposta non valida. Nuovo tentativo automatico.';
        } else if (errore instanceof TypeError) {
            risposta.textContent = 'Impossibile contattare il server. Controlla la rete; il monitor riprova automaticamente.';
        } else {
            risposta.textContent = errore.message || 'Impossibile connettersi al server.';
        }
        rawErrore.textContent = errore.erroreRaw || errore.message || '';
        dettagliErrore.hidden = !rawErrore.textContent;
        ultimoAggiornamento.textContent = 'Nessun dato aggiornato disponibile.';
        if (ultimoAggiornamentoRiuscito) {
            ultimoAggiornamento.textContent = `I dati visibili risalgono alle ${ultimoAggiornamentoRiuscito.toLocaleTimeString('it-IT')}.`;
        }
    } finally {
        caricamentoStato = false;
        clearTimeout(refreshTimer);
        if (!document.hidden && !repartoNonValido) {
            let attesa = INTERVALLO_REFRESH_MS;
            if (erroriConsecutivi === 1) attesa = 30000;
            if (erroriConsecutivi === 2) attesa = 60000;
            if (erroriConsecutivi >= 3) attesa = 120000;
            refreshTimer = setTimeout(caricaStato, attesa);
        }
    }
}

document.addEventListener('visibilitychange', () => {
    clearTimeout(refreshTimer);
    if (!document.hidden) caricaStato();
});

configuraPulsanteCoda();
caricaStato();
