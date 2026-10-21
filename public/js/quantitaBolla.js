// Autore: Cristian Ceni
// Ultima modifica: 21/10/2026
// Scopo: gestire la conversione dei metri dal cliente ai metri gestionale

// Ricerca e presentazione delle unità di misura per la quantità bolla.
const input = document.getElementById('inputArticolo');
const btn = document.getElementById('btnCerca');
const risultato = document.getElementById('risultato');
const erroreEl = document.getElementById('errore');
const cronologiaEl = document.getElementById('cronologia');
const freccia = document.getElementById('frecciaTeletrasporto');
const chiaveCronologia = 'cronologiaQuantitaBolla';
const formato = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 8 });
const formatoGestionale = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false
});

function elemento(tag, testo, classe) {
    const nodo = document.createElement(tag);
    if (testo !== undefined) nodo.textContent = testo;
    if (classe) nodo.className = classe;
    return nodo;
}

function leggiCronologia() {
    try {
        const dati = JSON.parse(localStorage.getItem(chiaveCronologia));
        return Array.isArray(dati) ? dati : [];
    } catch { return []; }
}

function scriviCronologia(voci) {
    try { localStorage.setItem(chiaveCronologia, JSON.stringify(voci)); } catch { /* Ricerca disponibile anche senza storage. */ }
    mostraCronologia();
}

function mostraCronologia() {
    cronologiaEl.replaceChildren();
    leggiCronologia().forEach(voce => {
        const riga = elemento('div', undefined, 'cronologia-item');
        const cercaVoce = elemento('button', `${voce.codice}${voce.descrizione ? ` — ${voce.descrizione}` : ''}`, 'cronologia-testo');
        cercaVoce.type = 'button';
        cercaVoce.addEventListener('click', () => { input.value = voce.codice; cerca(); });
        const rimuovi = elemento('button', '×', 'cronologia-rimuovi');
        rimuovi.type = 'button';
        rimuovi.setAttribute('aria-label', `Rimuovi ${voce.codice} dalla cronologia`);
        rimuovi.addEventListener('click', () => scriviCronologia(leggiCronologia().filter(v => v.codice !== voce.codice)));
        riga.append(cercaVoce, rimuovi);
        cronologiaEl.append(riga);
    });
}

function campo(titolo, valore) {
    const nodo = elemento('div', undefined, 'campo');
    nodo.append(elemento('span', titolo), elemento('span', valore || '—'));
    return nodo;
}

function mostraArticolo(articolo) {
    const config = CalcoliBolla.configurazione(articolo);
    const scheda = elemento('section', undefined, 'sezione-articolo sezione-controllo');
    scheda.append(elemento('p', `Articolo ${articolo.ARTICOLO}`, 'articolo-codice'),
        elemento('h2', articolo.DESCRIZIONE || 'Unità di misura', 'sezione-titolo'));
    const griglia = elemento('div', undefined, 'dati-griglia');
    const fattore = CalcoliBolla.numero(articolo.FATTPESO);
    griglia.append(campo('UM1', articolo.UM1), campo('UM2', articolo.UM2),
        campo('Fattore di conversione (FATTPESO)', Number.isFinite(fattore) ? formato.format(fattore) : '—'));
    scheda.append(griglia);
    if (Number.isFinite(fattore) && fattore > 0) {
        scheda.append(elemento('p', `1 ${articolo.UM1 || 'UM1'} = ${formato.format(fattore)} ${articolo.UM2 || 'UM2'}`));
    }

    const calcolo = elemento('section', undefined, 'sezione-articolo');
    calcolo.id = 'calcoloQuantita';
    calcolo.append(elemento('h2', 'Quantità da inserire su TeamSystem', 'sezione-titolo'));
    if (!config) {
        calcolo.append(elemento('p', 'Conversione non disponibile: servono due UM, una delle quali in pezzi (PZ), e un fattore di conversione maggiore di zero.', 'errore'));
    } else {
        calcolo.append(elemento('p', `I pezzi vengono arrotondati all’intero successivo e riconvertiti in ${config.unita}. Il valore per il gestionale è espresso con due decimali.`));
        const ingressi = elemento('div', undefined, 'conversione-input riga-dati-stampa');
        const richiesta = elemento('input');
        richiesta.id = 'quantitaCliente';
        richiesta.type = 'text';
        richiesta.inputMode = 'decimal';
        richiesta.autocomplete = 'off';
        richiesta.placeholder = 'Es. 10';
        const uscita = elemento('input');
        uscita.id = 'quantitaGestionale';
        uscita.type = 'text';
        uscita.readOnly = true;
        const etichettaCliente = elemento('label');
        etichettaCliente.htmlFor = richiesta.id;
        etichettaCliente.append(elemento('span', `Quantità cliente (${config.unita})`, 'blocco-stampa-titolo'), richiesta);
        const etichettaGestionale = elemento('label');
        etichettaGestionale.htmlFor = uscita.id;
        etichettaGestionale.append(elemento('span', `Da inserire nel gestionale (${config.unita})`, 'blocco-stampa-titolo'), uscita);
        ingressi.append(etichettaCliente, etichettaGestionale);
        const passaggi = elemento('p', 'Inserisci la quantità richiesta dal cliente.', 'conversione-passaggi');
        passaggi.id = 'passaggiConversione';
        passaggi.setAttribute('aria-live', 'polite');
        richiesta.setAttribute('aria-describedby', passaggi.id);
        richiesta.addEventListener('input', () => {
            const dati = CalcoliBolla.calcola(richiesta.value, config);
            uscita.value = dati ? formatoGestionale.format(dati.quantitaGestionale) : '';
            richiesta.setAttribute('aria-invalid', String(!dati && richiesta.value.trim() !== ''));
            passaggi.textContent = dati
                ? `${formato.format(dati.quantita)} ${config.unita} → ${formato.format(dati.pezziTeorici)} PZ → ${formato.format(dati.pezzi)} PZ interi → ${uscita.value} ${config.unita}`
                : richiesta.value.trim() ? 'Inserisci una quantità valida, maggiore o uguale a zero.' : 'Inserisci la quantità richiesta dal cliente.';
        });
        calcolo.append(ingressi, passaggi);
    }
    risultato.replaceChildren(scheda, calcolo);
    risultato.style.display = 'grid';
    aggiornaFreccia();
}

async function cerca() {
    if (btn.disabled) return;
    const codice = input.value.trim();
    if (!codice) { erroreEl.textContent = 'Inserisci un codice articolo'; input.focus(); return; }
    erroreEl.textContent = '';
    risultato.replaceChildren();
    risultato.style.display = 'none';
    aggiornaFreccia();
    btn.disabled = true;
    btn.textContent = 'Cerco...';
    try {
        const res = await fetch(`/api/attributi/articolo/${encodeURIComponent(codice)}`);
        if (res.status === 404) { erroreEl.textContent = 'Articolo non trovato'; input.focus(); input.select(); return; }
        if (!res.ok) throw new Error('Errore server');
        const articolo = await res.json();
        mostraArticolo(articolo);
        const voce = { codice: String(articolo.ARTICOLO || codice), descrizione: articolo.DESCRIZIONE || '' };
        scriviCronologia([voce, ...leggiCronologia().filter(v => v.codice !== voce.codice)].slice(0, 8));
    } catch { erroreEl.textContent = 'Errore di connessione al server'; }
    finally { btn.disabled = false; btn.textContent = 'Cerca'; }
}

function aggiornaFreccia() {
    freccia.style.display = risultato.style.display === 'grid' &&
        window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 10 ? 'flex' : 'none';
}
btn.addEventListener('click', cerca);
input.addEventListener('keydown', event => { if (event.key === 'Enter') cerca(); });
freccia.addEventListener('click', () => document.getElementById('calcoloQuantita')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
window.addEventListener('scroll', aggiornaFreccia);
window.addEventListener('resize', aggiornaFreccia);
mostraCronologia();
