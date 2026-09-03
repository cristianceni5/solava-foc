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
    if (risultato.style.display !== 'grid') {
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
    risultato.replaceChildren();
    anteprima.replaceChildren();
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

function creaElemento(tag, { className, text, id } = {}) {
    const elemento = document.createElement(tag);
    if (className) elemento.className = className;
    if (text !== undefined) elemento.textContent = text;
    if (id) elemento.id = id;
    return elemento;
}

function creaCampo(label, valore) {
    const campo = creaElemento('div', { className: 'campo' });
    campo.append(
        creaElemento('span', { text: label }),
        creaElemento('span', { text: valore ?? '—' })
    );
    return campo;
}

function creaUnitaMisura(codice, valore) {
    const unita = creaElemento('div', { className: 'unita-misura' });
    unita.append(
        creaElemento('span', { className: 'unita-misura-codice', text: codice }),
        creaElemento('strong', { className: 'unita-misura-valore', text: valore || 'Non presente' })
    );
    return unita;
}

function creaSezioneArticolo(eyebrow, titolo, idTitolo) {
    const sezione = creaElemento('section', { className: 'sezione-articolo' });
    const etichetta = creaElemento('p', { className: 'home-eyebrow', text: eyebrow });
    const heading = creaElemento('h2', { className: 'sezione-titolo', text: titolo, id: idTitolo });
    sezione.setAttribute('aria-labelledby', idTitolo);
    sezione.append(etichetta, heading);
    return sezione;
}

function creaBloccoStampa(titolo, contenuto, descrizione) {
    const blocco = creaElemento('section', { className: 'blocco-stampa' });
    blocco.append(creaElemento('h3', { className: 'blocco-stampa-titolo', text: titolo }));
    if (descrizione) blocco.append(creaElemento('p', { className: 'sezione-sottotitolo', text: descrizione }));
    blocco.append(contenuto);
    return blocco;
}

function creaInput({ id, tipo, valore, placeholder, min, max, required, label }) {
    const riga = creaElemento('div', { className: 'riga-dati-stampa' });
    const etichetta = creaElemento('label', { className: 'sr-only', text: label });
    etichetta.htmlFor = id;

    const input = creaElemento('input', { id });
    input.type = tipo;
    input.value = valore ?? '';
    input.placeholder = placeholder || '';
    input.autocomplete = 'off';
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (tipo === 'number') input.step = '1';
    if (required) input.required = true;

    riga.append(etichetta, input);
    return riga;
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
    const valori = {
        lotto: elementi.lotto.value.trim(),
        pezziPacco: elementi.pezzi.value,
        pezziBLK: elementi.pezziBLK.value,
        quantitaEtichette: elementi.quantita.value,
        mostraCE: document.getElementById('inMostraCE').checked,
        mostraICMQ: document.getElementById('inMostraICMQ').checked,
    };
    let campoNonValido = null;

    if (stampaLotto && !valori.lotto) {
        campoNonValido = elementi.lotto;
    } else if (valori.pezziPacco === '' || !Number.isInteger(Number(valori.pezziPacco)) || Number(valori.pezziPacco) < 0) {
        campoNonValido = elementi.pezzi;
    } else if (!Number.isInteger(Number(valori.pezziBLK)) || Number(valori.pezziBLK) <= 0) {
        campoNonValido = elementi.pezziBLK;
    } else if (!Number.isInteger(Number(valori.quantitaEtichette)) || Number(valori.quantitaEtichette) < 1 || Number(valori.quantitaEtichette) > 999) {
        campoNonValido = elementi.quantita;
    }

    Object.values(elementi).forEach(el => el.removeAttribute('aria-invalid'));
    if (campoNonValido) {
        campoNonValido.setAttribute('aria-invalid', 'true');
        campoNonValido.focus();
        return null;
    }
    return {
        ...valori,
        pezziPacco: Number(valori.pezziPacco),
        pezziBLK: Number(valori.pezziBLK),
        quantitaEtichette: Number(valori.quantitaEtichette)
    };
}

function creaSezioneAnagrafica(articolo) {
    const sezione = creaSezioneArticolo('Articolo', 'Anagrafica', 'titolo-anagrafica');
    const campi = [
        ['Articolo', articolo.codice], ['Descrizione', articolo.descrizione], ['Categoria', articolo.categoria],
        ['DOP', articolo.dop], ['Ente certificatore', articolo.enteCertificatore],
        ['Numero di marcatura CE', articolo.numeroMarcaturaCE], ['Peso (gr)', articolo.pesoGrammi],
        ['Descrizione aggiuntiva', articolo.descrizioneAggiuntiva], ['Stampa lotto', articolo.stampaLotto ? 'Sì' : 'No'],
        ['Stampa unità misura secondaria', articolo.stampaUnitaMisuraSecondaria ? 'Sì' : 'No']
    ];
    campi.forEach(([label, valore]) => sezione.append(creaCampo(label, valore)));
    return sezione;
}

function creaSezioneAttributi(caratteristiche) {
    const sezione = creaSezioneArticolo('Specifiche', 'Attributi estesi', 'titolo-attributi');
    const attributi = (caratteristiche || []).filter(({ etichetta, valore }) => etichetta || valore);
    if (attributi.length === 0) {
        sezione.append(creaElemento('p', { className: 'attr-vuoto', text: 'Nessun attributo esteso per questo articolo' }));
        return sezione;
    }
    attributi.forEach(({ etichetta, valore }) => sezione.append(creaCampo(etichetta || '—', valore)));
    return sezione;
}

function creaSezioneStampa(articolo) {
    const sezione = creaSezioneArticolo('Stampa etichetta', 'Dati del pacco', 'teletrasporto');
    const unita = creaElemento('div', { className: 'riga-dati-um' });
    unita.append(
        creaUnitaMisura('UM1', articolo.um1),
        creaUnitaMisura('UM2', articolo.um2)
    );

    const opzioni = creaElemento('div', { className: 'riga-opzioni-stampa' });
    [['inMostraCE', 'Mostra marchio CE'], ['inMostraICMQ', 'Mostra marchio ICMQ']].forEach(([id, testo]) => {
        const etichetta = creaElemento('label');
        const checkbox = creaElemento('input', { id });
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        etichetta.append(checkbox, document.createTextNode(testo));
        opzioni.append(etichetta);
    });

    const stato = creaElemento('div', { className: 'container-stato-stampa' });
    const select = creaElemento('select', { id: 'select-stampanti' });
    select.name = 'stampanti';
    [['stampante1', 'Stampante Uffici - Tiziana'], ['stampante2', 'Stampante Produzione - Box']].forEach(([valore, testo]) => {
        const opzione = creaElemento('option', { text: testo });
        opzione.value = valore;
        select.append(opzione);
    });
    const messaggio = creaElemento('p', { className: 'stato-stampa', text: 'In attesa', id: 'statoStampa' });
    messaggio.setAttribute('role', 'status');
    messaggio.setAttribute('aria-live', 'polite');
    stato.append(select, messaggio);

    const azioni = creaElemento('div', { className: 'azioni-anteprima' });
    const anteprima = creaElemento('button', { className: 'btn-anteprima', text: 'Anteprima', id: 'btnAnteprima' });
    const stampa = creaElemento('button', { className: 'btn-stampa', text: 'Stampa', id: 'btnStampa' });
    anteprima.type = stampa.type = 'button';
    azioni.append(anteprima, stampa);

    const stampaContenuto = document.createDocumentFragment();
    stampaContenuto.append(stato, azioni);
    sezione.append(
        creaBloccoStampa(
            'Pezzi per pacco',
            creaInput({ id: 'inPezziPacco', tipo: 'number', valore: articolo.pezziPerPacco, min: 0, label: 'Pezzi per pacco' }),
            'Pezzi effettivi sul pacco, dati dall’attributo esteso.'
        ),
        creaBloccoStampa(
            'Pezzi per BLK',
            creaInput({ id: 'inPezziBLK', tipo: 'number', valore: articolo.pezziPerSec ?? 1, min: 1, label: 'Pezzi per unità di misura secondaria' }),
            'Per prodotti senza questa unità di misura, lascia 1.'
        ),
        creaBloccoStampa('Unità di misura', unita),
        creaBloccoStampa(
            'Lotto',
            creaInput({ id: 'inLotto', tipo: 'text', placeholder: 'Lotto', required: articolo.stampaLotto, label: 'Lotto' })
        ),
        creaBloccoStampa(
            'Numero etichette da stampare',
            creaInput({ id: 'inQuantita', tipo: 'number', valore: 1, min: 1, max: 999, required: true, label: 'Numero etichette da stampare' })
        ),
        creaBloccoStampa('Normative nell’etichetta', opzioni),
        creaBloccoStampa('Stampante', stampaContenuto, 'Seleziona la stampante.')
    );
    return sezione;
}

// Costruisce le tre aree della pagina senza interpolare i dati del database in HTML.
function mostraRisultato(dati) {
    const a = dati.articolo;
    risultato.replaceChildren(
        creaSezioneAnagrafica(a),
        creaSezioneAttributi(dati.caratteristicheTecniche),
        creaSezioneStampa(a)
    );
    risultato.style.display = 'grid';
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
