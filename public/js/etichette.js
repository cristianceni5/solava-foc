// Scritto da Cristian Ceni 22/07/26
// Porting dello script inline di paginaEtichetta

const input = document.getElementById('inputArticolo');
const btn = document.getElementById('btnCerca');
const risultato = document.getElementById('risultato');
const anteprima = document.getElementById('anteprima')
const erroreEl = document.getElementById('errore');
const frecciaTeletrasporto = document.getElementById('frecciaTeletrasporto');
const cronologiaEl = document.getElementById('cronologia');

// Cronologia ultime ricerche, salvata nel browser (localStorage), non sul server
const CHIAVE_CRONOLOGIA = 'cronologiaEtichette';
const MAX_VOCI_CRONOLOGIA = 8;

function leggiCronologia() {
    try {
        const dati = JSON.parse(localStorage.getItem(CHIAVE_CRONOLOGIA));
        return Array.isArray(dati) ? dati : [];
    } catch {
        return [];
    }
}

function escapeHtml(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function mostraCronologia() {
    const cronologia = leggiCronologia();
    if (cronologia.length === 0) {
        cronologiaEl.innerHTML = '';
        return;
    }

    cronologiaEl.innerHTML = `
        ${cronologia.map(voce => `
            <div class="cronologia-item">
                <button type="button" class="cronologia-testo" data-codice="${escapeHtml(voce.codice)}">
                    <span class="codice">${escapeHtml(voce.codice)}</span>${voce.descrizione ? ` — ${escapeHtml(voce.descrizione)}` : ''}
                </button>
                <button type="button" class="cronologia-rimuovi" data-codice="${escapeHtml(voce.codice)}" title="Rimuovi dalla cronologia" aria-label="Rimuovi dalla cronologia">&times;</button>
            </div>
        `).join('')}
    `;

    cronologiaEl.querySelectorAll('.cronologia-testo').forEach(bottone => {
        bottone.addEventListener('click', () => {
            input.value = bottone.dataset.codice;
            cerca();
        });
    });

    cronologiaEl.querySelectorAll('.cronologia-rimuovi').forEach(bottone => {
        bottone.addEventListener('click', () => rimuoviDaCronologia(bottone.dataset.codice));
    });
}

// Aggiunge/aggiorna una voce in cima alla cronologia dopo una ricerca riuscita
function salvaInCronologia(codice, descrizione) {
    const cronologia = leggiCronologia().filter(voce => voce.codice !== codice);
    cronologia.unshift({ codice, descrizione });
    localStorage.setItem(CHIAVE_CRONOLOGIA, JSON.stringify(cronologia.slice(0, MAX_VOCI_CRONOLOGIA)));
    mostraCronologia();
}

function rimuoviDaCronologia(codice) {
    const cronologia = leggiCronologia().filter(voce => voce.codice !== codice);
    localStorage.setItem(CHIAVE_CRONOLOGIA, JSON.stringify(cronologia));
    mostraCronologia();
}

mostraCronologia();

frecciaTeletrasporto.addEventListener('click', () => {
    document.getElementById('teletrasporto')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// Se sono già in fondo alla pagina la freccia non serve, sennò va mostrata
function vicinoAlFondo() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
}

function aggiornaFreccia() {
    if (risultato.style.display !== 'block') {
        frecciaTeletrasporto.style.display = 'none';
        return;
    }
    frecciaTeletrasporto.style.display = vicinoAlFondo() ? 'none' : 'flex';
}

window.addEventListener('scroll', aggiornaFreccia);
window.addEventListener('resize', aggiornaFreccia);

async function cerca() {
    const codice = input.value.trim();
    if (!codice) {
        erroreEl.textContent = 'Inserisci un codice articolo';
        input.focus();
        return;
    }

    erroreEl.textContent = '';
    risultato.style.display = 'none';
    anteprima.style.display = 'none';
    aggiornaFreccia();
    btn.disabled = true;
    btn.textContent = 'Cerco...';

    try {
        const res = await fetch(`/api/etichette/articolo/${encodeURIComponent(codice)}`);

        if (res.status === 404) {
            erroreEl.textContent = 'Articolo non trovato';
            input.focus();
            input.select();
            return;
        }
        if (!res.ok) throw new Error('Errore server');

        const dati = await res.json();
        mostraRisultato(dati);
        salvaInCronologia(dati.articolo.codice, dati.articolo.descrizione);
    } catch (e) {
        erroreEl.textContent = 'Errore di connessione';
        input.focus();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Cerca';
    }
}

function campo(label, valore) {
    return `<div class="campo"><span>${escapeHtml(label)}</span><span>${escapeHtml(valore ?? '—')}</span></div>`;
}

// Cooldown dopo la stampa: il bottone resta disabilitato qualche secondo
// per evitare doppie stampe da click ripetuti sulla stampante fisica
function avviaCooldownStampa(bottone, secondi = 5) {
    bottone.disabled = true;
    let rimasti = secondi;
    bottone.textContent = `Attendi ${rimasti}s`;
    const timer = setInterval(() => {
        rimasti -= 1;
        if (rimasti <= 0) {
            clearInterval(timer);
            bottone.disabled = false;
            bottone.textContent = 'Stampa';
        } else {
            bottone.textContent = `Attendi ${rimasti}s`;
        }
    }, 1000);
}

function leggiDatiStampa(stampaLotto) {
    const elementi = {
        lotto: document.getElementById('inLotto'),
        pezzi: document.getElementById('inPezziPacco'),
        pezziBLK: document.getElementById('inPezziBLK'),
        quantita: document.getElementById('inQuantita'),
    };
    const dati = {
        lotto: elementi.lotto.value.trim(),
        pezziPacco: elementi.pezzi.value,
        pezziBLK: elementi.pezziBLK.value,
        quantitaEtichette: elementi.quantita.value,
        mostraCE: document.getElementById('inMostraCE').checked,
        mostraICMQ: document.getElementById('inMostraICMQ').checked,
    };
    let campoNonValido = null;

    if (stampaLotto && !dati.lotto) {
        campoNonValido = elementi.lotto;
    } else if (dati.pezziPacco === '' || !Number.isInteger(Number(dati.pezziPacco)) || Number(dati.pezziPacco) < 0) {
        campoNonValido = elementi.pezzi;
    } else if (!Number.isInteger(Number(dati.pezziBLK)) || Number(dati.pezziBLK) <= 0) {
        campoNonValido = elementi.pezziBLK;
    } else if (!Number.isInteger(Number(dati.quantitaEtichette)) || Number(dati.quantitaEtichette) < 1 || Number(dati.quantitaEtichette) > 999) {
        campoNonValido = elementi.quantita;
    }

    Object.values(elementi).forEach(el => el.removeAttribute('aria-invalid'));
    if (campoNonValido) {
        campoNonValido.setAttribute('aria-invalid', 'true');
        campoNonValido.focus();
        return null;
    }
    return dati;
}

// Funzione per mostrare i risultati della query con il numero di articolo
function mostraRisultato(dati) {
    const a = dati.articolo;

    const attributiEstesi = (dati.caratteristicheTecniche || [])
        .filter(c => c.etichetta || c.valore)
        .map(c => campo(c.etichetta || '—', c.valore))
        .join('');

    risultato.innerHTML = `
        <div class="sezione-articolo">
            <p class="sezione-titolo">Anagrafica</p>
            ${campo('Articolo', a.codice)}
            ${campo('Descrizione', a.descrizione)}
            ${campo('Categoria', a.categoria)}
            ${campo('DOP', a.dop)}
            ${campo('Ente certificatore', a.enteCertificatore)}
            ${campo('Numero di marcatura CE', a.numeroMarcaturaCE)}
            ${campo('Peso (gr)', a.pesoGrammi)}
            ${campo('Descrizione aggiuntiva', a.descrizioneAggiuntiva)}
            ${campo('Stampa lotto', a.stampaLotto ? 'Sì' : 'No')}
            ${campo('Stampa unità misura secondaria', a.stampaUnitaMisuraSecondaria ? 'Sì' : 'No')}
            ${campo('File etichetta', a.fileEtichetta)}
        </div>
        
        <div class="sezione-articolo">
            <p class="sezione-titolo">Attributi estesi</p>
            ${attributiEstesi || '<p class="attr-vuoto">Nessun attributo esteso per questo articolo</p>'}
        </div>

        <div class="sezione-articolo">
            <p class="sezione-titolo" id="teletrasporto">Pezzi per pacco</p>
            <p class="sezione-sottotitolo">Pezzi effettivi sul pacco, dati dall'attributo esteso</p>
            <div class="riga-dati-stampa">
                <label for="inPezziPacco" class="sr-only">Pezzi per pacco</label>
                <input type="number" id="inPezziPacco" min="0" step="1" value="${escapeHtml(a.pezziPerPacco ?? '')}">
            </div>

            <p class="sezione-titolo">Pezzi per BLK</p>
            <p class="sezione-sottotitolo">Quanti pezzi servono per fare un BLK, per prodotti senza questa unità di misura lasciare 1</p>
            <div class="riga-dati-stampa">
                <label for="inPezziBLK" class="sr-only">Pezzi per unità di misura secondaria: ${escapeHtml(a.pezziPerSec ?? '')}</label>
                <input type="number" id="inPezziBLK" min="0" step="1" value="${escapeHtml(a.pezziPerSec ?? '1')}">
            </div>

                <div class="riga-dati-um">
                <p class="sezione-titolo">Unità di misura 1:</p>
                <p class="valore-um">${escapeHtml(a.um1)}<p>
                <p class="sezione-titolo">Unità di misura 2:</p>
                <p class="valore-um">${escapeHtml(a.um2 ?? 'non presente')}<p>
            </div>  

            <p class="sezione-titolo">Lotto</p>
            <div class="riga-dati-stampa">
                <label for="inLotto" class="sr-only">Lotto</label>
                <input type="text" id="inLotto" placeholder="Lotto" autocomplete="off" ${a.stampaLotto ? 'required' : ''}>
            </div>
        
            <p class="sezione-titolo">Numero etichette da stampare</p>
            <div class="riga-dati-stampa">
                <label for="inQuantita" class="sr-only">Numero etichette da stampare</label>
                <input type="number" id="inQuantita" placeholder="Numero etichette" min="1" max="999" step="1" value="1" required>
            </div>
        
            <p class="sezione-titolo">Normative nell'etichetta</p>
            <div class="riga-opzioni-stampa">
            <label>
                <input type="checkbox" id="inMostraCE" checked>
                Mostra marchio CE
                </label>
                <label>
                <input type="checkbox" id="inMostraICMQ" checked>
                Mostra marchio ICMQ
                </label>
            </div>
        
            <p class="sezione-titolo">Stampante</p>
            <p class="sezione-sottotitolo">Seleziona la stampante</p>
            <div class="container-stato-stampa">
                <select name="stamapanti" id="select-stampanti">
                    <option value="stampante1">Stampante Uffici - Tiziana</option>
                    <option value="stampante2">Stampante Produzione - Box</option>
                </select>
                <p id="statoStampa" class="stato-stampa" role="status" aria-live="polite">In attesa</p>
            </div>

            <div class="azioni-anteprima">
                <button type="button" id="btnAnteprima" class="btn-anteprima">Anteprima</button>
                <button type="button" id="btnStampa" class="btn-stampa">Stampa</button>
            </div>
        </div>
    `;
    risultato.style.display = 'block';
    aggiornaFreccia();

    const inputStampanti = document.getElementById('select-stampanti');
    let stampanteScelta = inputStampanti.value;

    inputStampanti.addEventListener('change', (event) => {
        stampanteScelta = event.target.value;
    });

    // Anteprima con Labelary, non sempre fedele, specie negli attributi estesi.
    // TODO: sistemare questa problematica, altri file in ../routes/etichette.js
    function urlAnteprima() {
        const datiStampa = leggiDatiStampa(a.stampaLotto);
        if (!datiStampa) return null;
        const params = new URLSearchParams(datiStampa);
        return `/api/etichette/preview/${encodeURIComponent(a.codice)}?${params}`;
    }

    document.getElementById('btnAnteprima').addEventListener('click', () => {
        const url = urlAnteprima();
        if (!url) return;
        anteprima.innerHTML = `
        <div class="container-anteprima">
            <div id="anteprimaImg" class="anteprima-box">
                <p class="anteprima-placeholder">Compila i dati di stampa e genera l'anteprima</p>
            </div>
        </div>
        `;
        anteprima.style.display = 'block';

        const immagine = document.createElement('img');
        immagine.src = url;
        immagine.alt = 'Anteprima etichetta';
        immagine.addEventListener('error', () => {
            document.getElementById('anteprimaImg').textContent = 'Impossibile generare l’anteprima.';
        });
        document.getElementById('anteprimaImg').replaceChildren(immagine);
    });

    document.getElementById('btnStampa').addEventListener('click', async () => {
        const btnS = document.getElementById('btnStampa');
        const statoEl = document.getElementById('statoStampa');
        const datiStampa = leggiDatiStampa(a.stampaLotto);
        if (!datiStampa) return;
        if (!window.confirm(
            `Confermi la stampa?\n\nArticolo: ${a.codice}\nLotto: ${datiStampa.lotto || 'non previsto'}\nEtichette: ${datiStampa.quantitaEtichette}\nStampante: ${stampanteScelta}`
        )) return;

        btnS.disabled = true;
        btnS.textContent = 'Stampo...';
        statoEl.className = 'stato-stampa corso';
        statoEl.textContent = 'Invio alla stampante in corso...';

        try {
            const res = await fetch(`/api/etichette/stampa/${encodeURIComponent(a.codice)}/${stampanteScelta}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datiStampa)
            });
            const dati = await res.json();
            if (!res.ok || !dati.ok) throw new Error(dati.errore || 'Errore stampa');

            const orario = new Date(dati.ricevutaIl).toLocaleString('it-IT');
            statoEl.className = 'stato-stampa ok';
            statoEl.textContent = `Dati inviati alla stampante il ${orario}`;
            avviaCooldownStampa(btnS);
        } catch (e) {
            statoEl.className = 'stato-stampa errore';
            statoEl.textContent = `Stampa non ricevuta: ${e.message}`;
        } finally {
            if (btnS.textContent === 'Stampo...') {
                btnS.disabled = false;
                btnS.textContent = 'Stampa';
            }
        }
    });
}

btn.addEventListener('click', cerca);
input.addEventListener('keydown', e => { if (e.key === 'Enter') cerca(); });
