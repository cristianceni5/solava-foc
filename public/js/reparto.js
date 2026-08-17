// Scritto da Cristian Ceni 22/07/26
// Porting dello script inline di paginaReparto

// Tempo in secondi tra un aggiornamento completato e il successivo.
const OGNI_QUANTO_RICARICA = 5;
const INTERVALLO_REFRESH_MS = OGNI_QUANTO_RICARICA * 1000;
const LUNGHEZZA_MAX_DESCRIZIONE = 25;
// Colonne nascoste nella tabella principale ma chiamate nella query, sicchè modificare qui per altre colonne.
const COLONNE_NASCOSTE = new Set(['OPERATORE', 'STATO', 'QTA ORD']);
const params = new URLSearchParams(window.location.search);
const reparto = params.get('reparto');
let refreshTimer;
let ultimoAggiornamentoRiuscito = null;

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

function costruisciTabella(elIntestazione, elCorpo, righe) {
    elIntestazione.innerHTML = '';
    elCorpo.innerHTML = '';
    if (righe.length === 0) return;

    const colonne = Object.keys(righe[0]);
    const colonneVisibili = colonne.filter((colonna) => !COLONNE_NASCOSTE.has(colonna));
    const headRow = document.createElement('tr');
    for (const colonna of colonneVisibili) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = colonna;
        headRow.appendChild(th);
    }
    elIntestazione.appendChild(headRow);

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

async function caricaStato() {
    const banner = document.getElementById('status-banner');
    const stato = document.getElementById('stato');
    const risposta = document.getElementById('risposta');
    const ultimoAggiornamento = document.getElementById('ultimo-aggiornamento');

    function setStato(iconClass, testo) {
        stato.innerHTML = '';
        const icona = document.createElement('i');
        icona.className = iconClass;
        icona.setAttribute('aria-hidden', 'true');
        stato.appendChild(icona);
        stato.appendChild(document.createTextNode(` ${testo}`));
    }

    if (!reparto) {
        banner.className = 'stato-errore';
        setStato('fa-solid fa-triangle-exclamation', 'Reparto non specificato');
        risposta.innerHTML = 'Torna alla <a href="index.html">selezione del reparto</a>.';
        return;
    }

    try {
        const res = await fetch(`/api/stato?reparto=${encodeURIComponent(reparto)}`);
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.errore || 'Errore durante il caricamento');

        document.getElementById('nome-reparto-head').textContent = json.reparto || 'Reparto';
        const righe = Array.isArray(json.dati) ? json.dati : [json.dati];
        const intestazione = document.getElementById('tabella-intestazione');
        const tabella = document.getElementById('tabella-dati');
        ultimoAggiornamentoRiuscito = new Date();
        ultimoAggiornamento.textContent = `Ultimo aggiornamento: ${ultimoAggiornamentoRiuscito.toLocaleTimeString('it-IT')}`;

        if (righe.length === 0) {
            banner.className = 'stato-vuoto';
            setStato('fa-solid fa-circle-info', 'Nessuna lavorazione');
            risposta.textContent = 'Non risultano lavorazioni aperte in questo reparto, controlla MES.Frontend.';
            intestazione.innerHTML = '';
            tabella.innerHTML = '';
        } else {
            banner.className = 'stato-ok';
            setStato('fa-solid fa-circle-check', 'Lavorazioni aggiornate');
            risposta.textContent = '';
            costruisciTabella(intestazione, tabella, righe);
        }
    } catch (errore) {
        console.error('Errore caricamento reparto:', errore);
        banner.className = 'stato-errore';
        setStato('fa-solid fa-triangle-exclamation', 'Dati non aggiornati');
        risposta.textContent = errore.message || 'Impossibile connettersi al server.';
        ultimoAggiornamento.textContent = ultimoAggiornamentoRiuscito
            ? `I dati visibili risalgono alle ${ultimoAggiornamentoRiuscito.toLocaleTimeString('it-IT')}.`
            : 'Nessun dato aggiornato disponibile.';
    } finally {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(caricaStato, INTERVALLO_REFRESH_MS);
    }
}

caricaStato();
