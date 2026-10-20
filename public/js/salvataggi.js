// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: consultare i salvataggi con ordinamento, paginazione e dettaglio.

const DIMENSIONE_PAGINA = 25;
// Come nel monitor reparti: queste colonne restano nel record e nel dialog.
// Aggiungere qui i nomi esatti delle colonne da escludere dalla tabella.
const COLONNE_NASCOSTE = new Set(['OPERATORE', 'STATO', 'QTA ORD', 'QTA GG']);
const stato = document.getElementById('stato-salvataggi');
const precedente = document.getElementById('pagina-precedente');
const successiva = document.getElementById('pagina-successiva');
const aggiorna = document.getElementById('aggiorna-salvataggi');
const dialog = document.getElementById('anteprima-salvataggio');
const valoriDialog = document.getElementById('anteprima-salvataggio-valori');
let record = [];
let pagina = 1;
let caricamento = false;
const vistaReport = document.body.dataset.vista === 'report';
let idSelezionato = new URLSearchParams(window.location.search).get('id');
let giornoSelezionato = new URLSearchParams(window.location.search).get('giorno');
let meseCalendario = '';
const giornoRecord = riga => dataRecord(riga.DATA_ORA)?.slice(0, 10) || 'senza-data';
const giorniDisponibili = () => [...new Set(record.map(giornoRecord))].sort((a, b) =>
    a === 'senza-data' ? 1 : b === 'senza-data' ? -1 : b.localeCompare(a));
const dataGiorno = giorno => giorno === 'senza-data' ? 'Senza data' : giorno.split('-').reverse().join('/');

function riepilogaGiornata(righe) {
    const riepilogo = {};
    for (const campo of new Set(righe.flatMap(riga => Object.keys(riga)))) {
        const valori = righe.map(riga => riga[campo]).filter(v => v !== null && v !== undefined && v !== '');
        if (!valori.length) { riepilogo[campo] = null; continue; }
        if (/^(ORE_|TONN_|HZ_)/.test(campo) && valori.every(v => typeof v === 'number' && Number.isFinite(v))) {
            const minimo = Math.min(...valori), massimo = Math.max(...valori);
            riepilogo[campo] = minimo === massimo ? minimo : `${minimo} – ${massimo}`;
        } else if (campo === 'DATA_ORA') {
            const date = valori.map(dataRecord).filter(Boolean).sort();
            riepilogo[campo] = date.length
                ? `${dataGiorno(date[0].slice(0, 10))} - ${date[0].slice(11, 19)}${date[0] === date[date.length - 1] ? '' : ` – ${date[date.length - 1].slice(11, 19)}`}` : null;
        } else if (campo === 'ID') {
            riepilogo.SALVATAGGI = righe.length;
        } else {
            riepilogo[campo] = [...new Set(valori.map(v => formattaValore(campo, v)))].join(' - ');
        }
    }
    return riepilogo;
}

function scegliGiorno(giorno) {
    giornoSelezionato = giorno;
    idSelezionato = null;
    if (giorno !== 'senza-data') meseCalendario = giorno.slice(0, 7);
    chiudiCalendario(true);
    mostraRecord();
}

function chiudiCalendario(restituisciFocus = false) {
    document.getElementById('calendario-report').hidden = true;
    document.getElementById('apri-calendario').setAttribute('aria-expanded', 'false');
    if (restituisciFocus) document.getElementById('apri-calendario').focus();
}

function mostraCalendario() {
    const griglia = document.getElementById('calendario-giorni');
    griglia.replaceChildren();
    document.getElementById('calendario-mese').value = meseCalendario;
    const [anno, mese] = meseCalendario.split('-').map(Number);
    const primo = new Date(Date.UTC(anno, mese - 1, 1));
    const offset = (primo.getUTCDay() + 6) % 7;
    const totale = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
    const conteggi = new Map();
    record.forEach(riga => { const giorno = giornoRecord(riga); conteggi.set(giorno, (conteggi.get(giorno) || 0) + 1); });
    for (let i = 0; i < offset; i++) griglia.append(elemento('span', 'calendario-spazio'));
    for (let i = 1; i <= totale; i++) {
        const giorno = `${meseCalendario}-${String(i).padStart(2, '0')}`;
        const numero = conteggi.get(giorno) || 0;
        const pulsante = elemento('button', 'calendario-giorno');
        pulsante.type = 'button';
        pulsante.append(elemento('span', '', String(i)));
        if (numero) pulsante.append(elemento('small', '', String(numero)));
        pulsante.disabled = !numero;
        pulsante.setAttribute('aria-label', `${dataGiorno(giorno)}, ${numero} salvataggi`);
        pulsante.setAttribute('aria-pressed', String(giorno === giornoSelezionato));
        pulsante.addEventListener('click', () => scegliGiorno(giorno));
        griglia.append(pulsante);
    }
    document.getElementById('calendario-senza-data').hidden = !conteggi.has('senza-data');
}
const NOMI_CAMPI = {
    SALVATAGGI: 'Salvataggi',
    DATA_ORA: 'Data e ora', ID: 'ID', RICETTA_OMR: 'Ricetta OMR', RICETTA_MES: 'Ricetta MES',
    ORE_IMP_ACCESO_L1: 'L1 - Accensione (h)', ORE_IMP_LAVORAZIONE_L1: 'L1 - Lavorazione (h)',
    ORE_IMP_ACCESO_L2: 'L2 - Accensione (h)', ORE_IMP_LAVORAZIONE_L2: 'L2 - Lavorazione (h)',
    TONN_TERRA: 'Terra (t)',
    ...Object.fromEntries([1, 2, 3, 4, 5].map(n => [`HZ_CASSONE_${n}`, `Cassone ${n} (Hz)`]))
};
const nomeCampo = nome => NOMI_CAMPI[nome] || nome.replaceAll('_', ' ');

function elemento(tag, classe, testo) {
    const nodo = document.createElement(tag);
    if (classe) nodo.className = classe;
    if (testo !== undefined) nodo.textContent = testo;
    return nodo;
}

function linkReport(riga) {
    return `paginaReportSalvataggi.html?id=${encodeURIComponent(riga.ID ?? '')}`;
}

function confrontoRicette(righe) {
    return righe.every(riga => {
        const omr = String(riga.RICETTA_OMR ?? '').trim();
        const mes = String(riga.RICETTA_MES ?? '').trim();
        return omr !== '' && mes !== '' && omr === mes;
    }) ? 'coerenti' : 'diverse';
}

function mostraReport(risultati) {
    const sezione = document.getElementById('report-salvataggi');
    sezione.hidden = !vistaReport || !risultati.length;
    if (!vistaReport || !risultati.length) return;
    const richiesto = risultati.find(riga => String(riga.ID) === idSelezionato);
    if (richiesto) giornoSelezionato = giornoRecord(richiesto);
    else idSelezionato = null;
    const giorni = giorniDisponibili();
    if (!giorni.includes(giornoSelezionato)) giornoSelezionato = giornoRecord(risultati[0]);
    const giornata = risultati.filter(riga => giornoRecord(riga) === giornoSelezionato);
    const riga = richiesto || riepilogaGiornata(giornata);
    const indice = giorni.indexOf(giornoSelezionato);
    if (!meseCalendario && giornoSelezionato !== 'senza-data') meseCalendario = giornoSelezionato.slice(0, 7);
    if (!meseCalendario) meseCalendario = giorni.find(g => g !== 'senza-data')?.slice(0, 7)
        || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).format(new Date());
    document.getElementById('report-precedente').disabled = indice >= giorni.length - 1;
    document.getElementById('report-successivo').disabled = indice <= 0;
    document.getElementById('report-data').textContent = dataGiorno(giornoSelezionato);
    document.getElementById('report-titolo').textContent = richiesto ? `Salvataggio - ${richiesto.ID}` : 'Riepilogo giornaliero';
    const eventi = document.getElementById('report-eventi');
    const scorrimentoEventi = eventi.scrollLeft;
    eventi.replaceChildren();
    const sintesi = elemento('button', 'report-evento', `Riepilogo - ${giornata.length}`);
    sintesi.type = 'button';
    sintesi.setAttribute('aria-pressed', String(!richiesto));
    sintesi.addEventListener('click', () => { idSelezionato = null; mostraRecord(); });
    eventi.append(sintesi);
    giornata.forEach(voce => {
        const ora = dataRecord(voce.DATA_ORA)?.slice(11, 19) || 'Senza ora';
        const pulsante = elemento('button', 'report-evento', `${ora} -  ${voce.ID ?? '—'}`);
        pulsante.type = 'button';
        pulsante.setAttribute('aria-pressed', String(voce === richiesto));
        pulsante.addEventListener('click', () => { idSelezionato = String(voce.ID); mostraRecord(); });
        eventi.append(pulsante);
    });
    eventi.scrollLeft = scorrimentoEventi;
    const url = richiesto ? linkReport(richiesto) : `paginaReportSalvataggi.html?giorno=${encodeURIComponent(giornoSelezionato)}`;
    document.getElementById('vista-tabella').href = richiesto ? `paginaSalvataggi.html?id=${encodeURIComponent(richiesto.ID)}` : 'paginaSalvataggi.html';
    document.getElementById('vista-report').href = url;
    window.history.replaceState(null, '', url);
    mostraCalendario();
    const griglia = document.getElementById('report-griglia');
    griglia.replaceChildren();
    const usati = new Set();
    const gruppi = [
        { titolo: richiesto ? 'Identificazione' : 'Giornata', classe: 'report-identita', campi: ['ID', 'SALVATAGGI', 'DATA_ORA', 'RICETTA_OMR', 'RICETTA_MES'] },
        { titolo: 'Linea 1', classe: 'report-linea', campi: ['ORE_IMP_ACCESO_L1', 'ORE_IMP_LAVORAZIONE_L1'] },
        { titolo: 'Linea 2', classe: 'report-linea', campi: ['ORE_IMP_ACCESO_L2', 'ORE_IMP_LAVORAZIONE_L2'] },
        { titolo: 'Produzione', classe: 'report-produzione', campi: ['TONN_TERRA'] },
        { titolo: 'Cassoni', classe: 'report-cassoni', campi: [1, 2, 3, 4, 5].map(n => `HZ_CASSONE_${n}`) }
    ];
    gruppi.forEach(gruppo => {
        const campi = gruppo.campi.filter(campo => Object.hasOwn(riga, campo));
        if (!campi.length) return;
        griglia.append(creaCardReport(gruppo.titolo, gruppo.classe, campi, riga,
            confrontoRicette(richiesto ? [richiesto] : giornata)));
        campi.forEach(campo => usati.add(campo));
    });
    const altri = Object.keys(riga).filter(campo => !usati.has(campo));
    if (altri.length) griglia.append(creaCardReport('Altri dati', 'report-altri', altri, riga));
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.gsap.fromTo(griglia.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: .045, duration: .3, clearProps: 'all' });
    }
}

function creaCardReport(titolo, classe, campi, riga, esitoRicette) {
    const card = elemento('section', `report-card ${classe}`);
    card.append(elemento('h3', '', titolo));
    const lista = elemento('dl', 'report-campi');
    for (const campo of campi) {
        const voce = elemento('div', 'report-campo');
        voce.dataset.campo = campo;
        if (campo === 'RICETTA_OMR' || campo === 'RICETTA_MES') {
            voce.dataset.ricette = esitoRicette;
            voce.title = esitoRicette === 'coerenti' ? 'Ricette OMR e MES coincidenti' : 'Ricette OMR e MES diverse o incomplete';
        }
        voce.append(elemento('dt', '', nomeCampo(campo)), elemento('dd', '', formattaValore(campo, riga[campo])));
        lista.append(voce);
    }
    card.append(lista);
    return card;
}

function dataRecord(valore) {
    const parti = String(valore ?? '').match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?)?/);
    if (!parti) return null;
    const millisecondi = (parti[3] || '').padEnd(3, '0').slice(0, 3);
    return `${parti[1]}T${parti[2] || '00:00:00'}.${millisecondi}`;
}

function recordVisualizzati() {
    return record
        .map((riga, indice) => ({ riga, indice, data: dataRecord(riga.DATA_ORA) || '' }))
        .sort((a, b) => {
            if (!a.data) return b.data ? 1 : a.indice - b.indice;
            if (!b.data) return -1;
            const confronto = a.data.localeCompare(b.data);
            return confronto ? -confronto : a.indice - b.indice;
        })
        .map(voce => voce.riga);
}

function formattaValore(colonna, valore) {
    if (valore === null || valore === undefined || valore === '') return '-';
    // Mantiene l'orario restituito dal database, senza conversioni di fuso orario.
    if (colonna === 'DATA_ORA' && typeof valore === 'string') {
        const data = valore.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
        if (data) return `${data[3]}/${data[2]}/${data[1]} ${data[4]}`;
    }
    return typeof valore === 'object' ? JSON.stringify(valore) : String(valore);
}

function apriDettaglio(riga) {
    document.getElementById('vista-report').href = linkReport(riga);
    document.getElementById('apri-report-salvataggio').href = linkReport(riga);
    valoriDialog.replaceChildren();
    for (const [colonna, valore] of Object.entries(riga)) {
        const campo = document.createElement('div');
        campo.className = 'anteprima-campo';
        const etichetta = document.createElement('dt');
        etichetta.textContent = nomeCampo(colonna);
        const contenuto = document.createElement('dd');
        contenuto.textContent = formattaValore(colonna, valore);
        campo.append(etichetta, contenuto);
        valoriDialog.append(campo);
    }
    dialog.showModal();
}

function mostraRecord() {
    const risultati = recordVisualizzati();
    mostraReport(risultati);
    const pagine = Math.max(1, Math.ceil(risultati.length / DIMENSIONE_PAGINA));
    pagina = Math.min(pagina, pagine);
    const inizio = (pagina - 1) * DIMENSIONE_PAGINA;
    const visibili = risultati.slice(inizio, inizio + DIMENSIONE_PAGINA);
    const intestazione = document.getElementById('intestazione-salvataggi');
    const corpo = document.getElementById('righe-salvataggi');
    intestazione.replaceChildren();
    corpo.replaceChildren();
    const vuoto = document.getElementById('salvataggi-vuoto');
    vuoto.hidden = risultati.length !== 0;
    vuoto.textContent = 'Nessun salvataggio disponibile.';
    document.getElementById('contenitore-salvataggi').hidden = vistaReport || record.length === 0;
    document.getElementById('paginazione-salvataggi').hidden = vistaReport || risultati.length === 0;
    document.getElementById('conteggio-salvataggi').textContent = risultati.length
        ? vistaReport ? '' : `${inizio + 1}–${inizio + visibili.length} / ${risultati.length}`
        : '0 salvataggi';
    document.getElementById('numero-pagina').textContent = `Pagina ${pagina} di ${pagine}`;
    precedente.disabled = pagina <= 1;
    successiva.disabled = pagina >= pagine;
    if (!record.length) return;

    const colonne = [...new Set(record.flatMap(riga => Object.keys(riga)))];
    const colonneVisibili = colonne.filter(colonna => !COLONNE_NASCOSTE.has(colonna));
    if (colonne.includes('ID')) {
        const priorita = ['DATA_ORA', 'ID', 'RICETTA_OMR', 'RICETTA_MES', 'TONN_TERRA'];
        colonneVisibili.sort((a, b) => {
            const rango = nome => priorita.includes(nome) ? priorita.indexOf(nome) : priorita.length;
            return rango(a) - rango(b);
        });
    }
    const header = document.createElement('tr');
    for (const colonna of colonneVisibili) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = colonna.replaceAll('_', ' ');
        th.dataset.colonna = colonna;
        if (colonna === 'DATA_ORA') th.setAttribute('aria-sort', 'descending');
        header.append(th);
    }
    intestazione.append(header);
    for (const riga of visibili) {
        const tr = document.createElement('tr');
        tr.classList.add('riga-cliccabile');
        tr.tabIndex = 0;
        tr.setAttribute('role', 'button');
        tr.setAttribute('aria-haspopup', 'dialog');
        tr.setAttribute('aria-label', 'Apri il dettaglio completo del salvataggio');
        tr.title = 'Apri il dettaglio completo';
        if (idSelezionato !== null && String(riga.ID) === idSelezionato) {
            tr.classList.add('riga-selezionata');
            tr.setAttribute('aria-label', `Salvataggio ${riga.ID}, selezionato. Apri il dettaglio completo`);
        }
        tr.addEventListener('click', () => apriDettaglio(riga));
        tr.addEventListener('keydown', evento => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                apriDettaglio(riga);
            }
        });
        for (const colonna of colonneVisibili) {
            const td = document.createElement('td');
            td.dataset.label = colonna.replaceAll('_', ' ');
            td.dataset.colonna = colonna;
            if (colonna === 'RICETTA_OMR' || colonna === 'RICETTA_MES') {
                td.dataset.ricette = confrontoRicette([riga]);
                td.title = td.dataset.ricette === 'coerenti' ? 'Ricette OMR e MES coincidenti' : 'Ricette OMR e MES diverse o incomplete';
            }
            td.textContent = formattaValore(colonna, riga[colonna]);
            tr.append(td);
        }
        corpo.append(tr);
    }
}

async function caricaSalvataggi() {
    if (caricamento) return;
    caricamento = true;
    aggiorna.disabled = true;
    stato.className = '';
    stato.textContent = 'Caricamento salvataggi...';
    try {
        const res = await fetch('/api/salvataggi/prelavorazione', { cache: 'no-store' });
        const risposta = await res.json();
        if (!res.ok || !risposta.ok) throw new Error(risposta.errore || 'Salvataggi non disponibili');
        if (!Array.isArray(risposta.dati)) throw new Error('Formato dei salvataggi non valido');
        record = risposta.dati;
        pagina = 1;
        if (!vistaReport && idSelezionato !== null) {
            const indice = recordVisualizzati().findIndex(riga => String(riga.ID) === idSelezionato);
            if (indice >= 0) {
                pagina = Math.floor(indice / DIMENSIONE_PAGINA) + 1;
                document.getElementById('vista-report').href = linkReport(recordVisualizzati()[indice]);
            }
        }
        mostraRecord();
        stato.textContent = record.length
            ? record.length >= risposta.limite ? `Ultimi ${risposta.limite} salvataggi` : ''
            : 'Nessun salvataggio disponibile.';
        document.getElementById('ultimo-caricamento').textContent = `Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}`;
    } catch (err) {
        stato.className = 'errore';
        stato.textContent = `${err.message}. Premi Aggiorna dati per riprovare.${record.length ? ' I dati visibili risalgono al precedente caricamento.' : ''}`;
    } finally {
        caricamento = false;
        aggiorna.disabled = false;
    }
}

aggiorna.addEventListener('click', caricaSalvataggi);
precedente.addEventListener('click', () => { pagina--; mostraRecord(); });
successiva.addEventListener('click', () => { pagina++; mostraRecord(); });
document.getElementById('chiudi-anteprima-salvataggio').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', evento => {
    if (evento.target === dialog) dialog.close();
});
for (const [id, delta] of [['report-precedente', 1], ['report-successivo', -1]]) {
    document.getElementById(id).addEventListener('click', () => {
        const giorni = giorniDisponibili();
        const giorno = giorni[giorni.indexOf(giornoSelezionato) + delta];
        if (giorno) scegliGiorno(giorno);
    });
}
document.getElementById('apri-calendario').addEventListener('click', () => {
    const calendario = document.getElementById('calendario-report');
    calendario.hidden = !calendario.hidden;
    document.getElementById('apri-calendario').setAttribute('aria-expanded', String(!calendario.hidden));
    if (!calendario.hidden) {
        mostraCalendario();
        document.getElementById('calendario-mese').focus();
    }
});
document.getElementById('calendario-mese').addEventListener('change', evento => {
    if (/^\d{4}-\d{2}$/.test(evento.target.value)) { meseCalendario = evento.target.value; mostraCalendario(); }
});
for (const [id, delta] of [['mese-precedente', -1], ['mese-successivo', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
        const [anno, mese] = meseCalendario.split('-').map(Number);
        const data = new Date(Date.UTC(anno, mese - 1 + delta, 1));
        meseCalendario = data.toISOString().slice(0, 7);
        mostraCalendario();
    });
}
document.getElementById('calendario-senza-data').addEventListener('click', () => scegliGiorno('senza-data'));
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('calendario-report').hidden) chiudiCalendario(true);
});
document.addEventListener('click', evento => {
    if (!evento.target.closest('.report-selezione')) chiudiCalendario();
});
caricaSalvataggi();
