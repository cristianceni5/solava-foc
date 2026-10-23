const statoPc = document.getElementById('stato-pc');
const elencoPc = document.getElementById('elenco-pc');
const aggiornaPc = document.getElementById('aggiorna-pc');
const excelPc = document.getElementById('excel-pc');
const dataAggiornamentoPc = document.getElementById('ultimo-caricamento-pc');
const conteggioPc = document.getElementById('conteggio-pc');
const paginazionePc = document.getElementById('paginazione-pc');
const precedentePc = document.getElementById('pc-precedente');
const successivaPc = document.getElementById('pc-successiva');
const numeroPaginaPc = document.getElementById('pc-numero-pagina');
const dettagliErrorePc = document.getElementById('errore-pc-dettagli');
const testoErrorePc = document.getElementById('errore-pc-raw');
const PC_PER_PAGINA = 25;
const vistaReportPc = document.body?.dataset?.vista === 'report';
const colonnePc = [
    { chiave: 'ip', etichetta: 'Indirizzo IP', formatta: ip => ['::1', '127.0.0.1'].includes(ip) ? `${ip} (Localhost)` : ip },
    { chiave: 'connesso', etichetta: 'Stato', formatta: valore => valore ? 'Connesso' : 'Non attivo' },
    { chiave: 'pagina', etichetta: 'Ultima pagina' },
    { chiave: 'reparto', etichetta: 'Reparto', formatta: (id, voce) => voce.nomeReparto ? `${voce.nomeReparto}` : id ? `${id} (non riconosciuto)` : '—' },
    { chiave: 'primoAccesso', etichetta: 'Primo accesso', formatta: valore => new Date(valore).toLocaleString('it-IT') },
    { chiave: 'ultimoContatto', etichetta: 'Ultimo contatto', formatta: valore => new Date(valore).toLocaleString('it-IT') }
];
const dataReportPc = document.getElementById('pc-giorno');
let giorniReportPc = [];
let datiReportPc = [];
let giornoReportCaricato = '';
const colonneReportPc = [
    { chiave: 'ip', etichetta: 'Computer', ampio: true },
    { chiave: 'primoContatto', etichetta: 'Prima rilevazione', formatta: valore => new Date(valore).toLocaleString('it-IT') },
    { chiave: 'ultimoContatto', etichetta: 'Ultima rilevazione', formatta: valore => new Date(valore).toLocaleString('it-IT') },
    { chiave: 'secondiOsservati', etichetta: 'Tempo osservato (stimato)', formatta: valore => AnalisiReport.durata(valore) },
    { chiave: 'rilevazioni', etichetta: 'Rilevazioni ricevute' },
    { chiave: 'usi', etichetta: 'Pagine e reparti usati', ampio: true, formatta: valore => (valore || []).map(uso => AnalisiReport.nomePagina(uso.pagina) + (uso.reparto ? ' · ' + (uso.nomeReparto || uso.reparto) : '') + ': ' + uso.rilevazioni + ' rilevazioni').join('\n') }
];
const reportPc = vistaReportPc ? creaReportTabella({
    contenitore: document.getElementById('report-pc'), titolo: 'Uso giornaliero del FOP',
    layout: 'dashboard', etichettaSelettore: 'Computer',
    toolbar: document.getElementById('report-pc-data-toolbar'),
    colonne: colonneReportPc, chiave: voce => voce.ip, etichetta: voce => 'Computer ' + voce.ip,
    riepilogo: records => AnalisiReport.riepilogoPc(records),
    messaggioVuoto: 'Nessuna rilevazione per questa data. Lo storico inizia con l’attivazione della raccolta giornaliera.'
}) : null;
let recordPc = [];
let paginaPc = 1;
let caricamentoPc = false;
let ultimoAggiornamentoPc = '';

function valoriPc(voce) {
    return colonnePc.map(colonna => colonna.formatta ? colonna.formatta(voce[colonna.chiave], voce) : voce[colonna.chiave]);
}

function mostraPaginaPc() {
    const pagine = Math.max(1, Math.ceil(recordPc.length / PC_PER_PAGINA));
    paginaPc = Math.max(1, Math.min(paginaPc, pagine));
    const inizio = (paginaPc - 1) * PC_PER_PAGINA;
    const righe = recordPc.slice(inizio, inizio + PC_PER_PAGINA).map(voce => {
        const riga = document.createElement('tr');
        valoriPc(voce).forEach((valore, indice) => {
            const cella = document.createElement('td');
            cella.textContent = valore;
            if (colonnePc[indice].chiave === 'connesso') cella.className = voce.connesso ? 'pc-attivo' : 'pc-inattivo';
            riga.append(cella);
        });
        return riga;
    });
    if (!righe.length) {
        const riga = document.createElement('tr');
        const cella = document.createElement('td');
        cella.colSpan = colonnePc.length;
        cella.className = 'pc-vuoto';
        cella.textContent = 'Nessun PC registrato. I PC compaiono dopo il primo segnale al server.';
        riga.append(cella);
        righe.push(riga);
    }
    elencoPc.replaceChildren(...righe);
    paginazionePc.hidden = vistaReportPc || recordPc.length <= PC_PER_PAGINA;
    precedentePc.disabled = paginaPc <= 1;
    successivaPc.disabled = paginaPc >= pagine;
    numeroPaginaPc.textContent = `Pagina ${paginaPc} di ${pagine}`;
    const riepilogo = `${recordPc.filter(voce => voce.connesso).length} connessi · ${recordPc.length} registrati`;
    conteggioPc.textContent = recordPc.length && !vistaReportPc
        ? `${riepilogo} · Visualizzati ${inizio + 1}–${Math.min(inizio + PC_PER_PAGINA, recordPc.length)}`
        : riepilogo;
    excelPc.disabled = recordPc.length === 0;
}

async function caricaPc() {
    if (caricamentoPc) return;
    caricamentoPc = true;
    aggiornaPc.disabled = true;
    if (dataReportPc) dataReportPc.disabled = true;
    elencoPc.setAttribute('aria-busy', 'true');
    try {
        const risposta = await fetch('/api/pc-connessi', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (risposta.status === 401) {
            window.location.assign('/autenticazione.html?ritorno=' + encodeURIComponent(
                vistaReportPc ? '/paginaReportPcConnessi.html' : '/paginaPcConnessi.html'));
            return;
        }
        const pc = await risposta.json();
        if (!risposta.ok) {
            const errore = new Error(pc.errore || 'Impossibile leggere i PC connessi');
            errore.erroreRaw = pc.erroreRaw;
            throw errore;
        }
        if (!Array.isArray(pc)) throw new Error('Elenco non valido');
        recordPc = pc;
        mostraPaginaPc();
        if (reportPc) {
            const query = dataReportPc.value ? '?giorno=' + encodeURIComponent(dataReportPc.value) : '';
            const resReport = await fetch('/api/pc-connessi/report' + query, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            const storico = await resReport.json();
            if (!resReport.ok) {
                const errore = new Error(storico.errore || 'Report non disponibile');
                errore.erroreRaw = storico.erroreRaw;
                throw errore;
            }
            dataReportPc.value = storico.giorno;
            giornoReportCaricato = storico.giorno;
            giorniReportPc = storico.giorni;
            datiReportPc = storico.dati;
            reportPc.aggiorna(datiReportPc);
            calendarioPc.aggiorna(storico.giorno, new Map(Object.entries(storico.conteggi || Object.fromEntries(giorniReportPc.map(g => [g, 1])))));
            excelPc.disabled = datiReportPc.length === 0;
            conteggioPc.textContent = datiReportPc.length + ' PC rilevati il ' + new Date(storico.giorno + 'T12:00:00').toLocaleDateString('it-IT');
        }
        ultimoAggiornamentoPc = new Date().toLocaleTimeString('it-IT');
        dataAggiornamentoPc.textContent = `Ultimo aggiornamento: ${ultimoAggiornamentoPc}`;
        statoPc.textContent = '';
        statoPc.className = '';
        if (dettagliErrorePc) { dettagliErrorePc.hidden = true; dettagliErrorePc.open = false; testoErrorePc.textContent = ''; }
    } catch (errore) {
        if (vistaReportPc) {
            excelPc.disabled = true;
            if (giornoReportCaricato) {
                dataReportPc.value = giornoReportCaricato;
                conteggioPc.textContent = 'Report precedente del ' + new Date(giornoReportCaricato + 'T12:00:00').toLocaleDateString('it-IT');
            }
        }
        statoPc.className = 'errore';
        statoPc.textContent = (errore.erroreRaw ? errore.message + '. ' : 'Impossibile aggiornare i PC. ')
            + 'Riprova o attendi 15 secondi.'
            + (ultimoAggiornamentoPc ? ` Dati precedenti delle ${ultimoAggiornamentoPc}.` : '');
        if (dettagliErrorePc) {
            testoErrorePc.textContent = errore.erroreRaw || errore.message || '';
            dettagliErrorePc.hidden = !testoErrorePc.textContent;
        }
    } finally {
        caricamentoPc = false;
        aggiornaPc.disabled = false;
        if (dataReportPc) dataReportPc.disabled = false;
        elencoPc.setAttribute('aria-busy', 'false');
    }
}
aggiornaPc.addEventListener('click', caricaPc);
precedentePc.addEventListener('click', () => { paginaPc--; mostraPaginaPc(); });
successivaPc.addEventListener('click', () => { paginaPc++; mostraPaginaPc(); });
excelPc.addEventListener('click', () => {
    if (!excelPc.disabled) {
        const colonne = vistaReportPc ? colonneReportPc : colonnePc;
        const dati = vistaReportPc ? datiReportPc : recordPc;
        const righe = dati.map(voce => colonne.map(c => c.formatta ? c.formatta(voce[c.chiave], voce) : voce[c.chiave]));
        exportTableToExcel('tabella-pc', vistaReportPc ? 'usoFOP-' + dataReportPc.value : 'computerConnessi', [colonne.map(c => c.etichetta), ...righe]);
    }
});
// Attende il primo segnale per includere anche questo PC, con avvio di riserva.
let elencoAvviato = false;
function avviaElencoPc() {
    if (elencoAvviato) return;
    elencoAvviato = true;
    caricaPc();
}
window.addEventListener('fop-presenza', avviaElencoPc, { once: true });
window.setTimeout(avviaElencoPc, 1500);
window.setInterval(caricaPc, 15000);

const calendarioPc = vistaReportPc ? creaCalendarioReport({
    unita: 'PC rilevati', scegli: giorno => {
        if (caricamentoPc) return;
        dataReportPc.value = giorno; caricaPc();
    }
}) : null;
