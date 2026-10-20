// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: cercare articoli e presentare gli attributi estesi in gruppi leggibili.

const input = document.getElementById('inputArticolo');
const btn = document.getElementById('btnCerca');
const risultato = document.getElementById('risultato');
const erroreEl = document.getElementById('errore');
const frecciaTeletrasporto = document.getElementById('frecciaTeletrasporto');
const cronologiaEl = document.getElementById('cronologia');

const CHIAVE_CRONOLOGIA = 'cronologiaAttributiEstesi';
const MAX_VOCI_CRONOLOGIA = 8;
const CAMPI_PRIORITARI = [
    { nomi: ['PEZZIPACCO', 'PEZZI_PACCO'], etichetta: 'Pezzi per pacco' },
    { nomi: ['PEZZIUM2', 'PEZZI_UM2'], etichetta: 'Pezzi UM2' },
    { nomi: ['PROGRAMMA'], etichetta: 'Programma' },
    { nomi: ['RICETTA'], etichetta: 'Ricetta' }
];

function creaElemento(tag, { className, text, id } = {}) {
    const elemento = document.createElement(tag);
    if (className) elemento.className = className;
    if (text !== undefined) elemento.textContent = text;
    if (id) elemento.id = id;
    return elemento;
}

function leggiCronologia() {
    try {
        const dati = JSON.parse(localStorage.getItem(CHIAVE_CRONOLOGIA));
        return Array.isArray(dati) ? dati : [];
    } catch {
        return [];
    }
}

function salvaCronologia(codice, descrizione) {
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

function mostraCronologia() {
    cronologiaEl.replaceChildren();

    leggiCronologia().forEach(voce => {
        const contenitore = creaElemento('div', { className: 'cronologia-item' });
        const cercaVoce = creaElemento('button', { className: 'cronologia-testo' });
        cercaVoce.type = 'button';
        cercaVoce.append(
            creaElemento('span', { className: 'codice', text: voce.codice }),
            document.createTextNode(voce.descrizione ? ` — ${voce.descrizione}` : '')
        );
        cercaVoce.addEventListener('click', () => {
            input.value = voce.codice;
            cerca();
        });

        const rimuovi = creaElemento('button', { className: 'cronologia-rimuovi', text: '×' });
        rimuovi.type = 'button';
        rimuovi.title = 'Rimuovi dalla cronologia';
        rimuovi.setAttribute('aria-label', 'Rimuovi dalla cronologia');
        rimuovi.addEventListener('click', () => rimuoviDaCronologia(voce.codice));
        contenitore.append(cercaVoce, rimuovi);
        cronologiaEl.append(contenitore);
    });
}

function valoreDaMostrare(valore) {
    if (valore === null || valore === undefined || valore === '') return '—';
    if (typeof valore === 'object') return JSON.stringify(valore);
    return String(valore);
}

function etichettaCampo(nome) {
    return nome.replace(/_/g, ' ').replace(/\b\w/g, lettera => lettera.toUpperCase());
}

function creaCampo(nome, valore, prioritario = false) {
    const campo = creaElemento('div', { className: prioritario ? 'campo campo-prioritario' : 'campo' });
    campo.append(
        creaElemento('span', { text: nome }),
        creaElemento('span', { text: valoreDaMostrare(valore) })
    );
    return campo;
}

function campoVuoto(valore) {
    return valore === null || valore === undefined ||
        (typeof valore === 'string' && valore.trim() === '');
}

function creaGrigliaAttributi(campi) {
    const griglia = creaElemento('div', { className: 'dati-griglia dati-griglia-attributi' });
    campi.forEach(([nome, valore]) => griglia.append(creaCampo(etichettaCampo(nome), valore)));
    return griglia;
}

function mostraRisultato(attributi) {
    const sezione = creaElemento('section', { className: 'sezione-articolo sezione-controllo' });
    const codice = attributi.ARTICOLO ?? attributi.articolo ?? input.value.trim();
    const descrizione = attributi.DESCRIZIONE ?? attributi.descrizione;

    sezione.append(
        creaElemento('p', { className: 'articolo-codice', text: `Articolo ${codice}` }),
        creaElemento('h2', { className: 'sezione-titolo', text: descrizione || 'Attributi estesi', id: 'teletrasporto' })
    );

    const campi = Object.entries(attributi)
        .filter(([nome]) => !['ARTICOLO', 'DESCRIZIONE'].includes(nome.toUpperCase()));
    if (campi.length === 0) {
        sezione.append(creaElemento('p', { className: 'attr-vuoto', text: 'Nessun attributo esteso disponibile per questo articolo.' }));
    } else {
        const campiPerNome = new Map(campi.map(([nome, valore]) => [nome.toUpperCase(), [nome, valore]]));
        const principali = creaElemento('div', { className: 'attributi-principali' });
        const chiaviPrincipali = new Set();

        CAMPI_PRIORITARI.forEach(({ nomi, etichetta }) => {
            const campo = nomi.map(nome => campiPerNome.get(nome)).find(Boolean);
            if (!campo) return;
            chiaviPrincipali.add(campo[0]);
            principali.append(creaCampo(etichetta, campo[1], true));
        });

        if (principali.childElementCount > 0) {
            principali.prepend(creaElemento('h3', { className: 'titolo-attributi-principali', text: 'Dati principali' }));
            sezione.append(principali);
        }

        const altriCampi = campi.filter(([nome]) => !chiaviPrincipali.has(nome));
        const compilati = altriCampi.filter(([, valore]) => !campoVuoto(valore));
        const vuoti = altriCampi.filter(([, valore]) => campoVuoto(valore));

        if (compilati.length > 0) {
            const dettagli = creaElemento('div', { className: 'attributi-dettagli' });
            dettagli.append(
                creaElemento('h3', { className: 'titolo-attributi-dettagli', text: `Altri attributi (${compilati.length})` }),
                creaGrigliaAttributi(compilati)
            );
            sezione.append(dettagli);
        }

        if (vuoti.length > 0) {
            const dettagliVuoti = creaElemento('details', { className: 'attributi-vuoti' });
            dettagliVuoti.append(
                creaElemento('summary', { text: `Mostra campi senza valore (${vuoti.length})` }),
                creaGrigliaAttributi(vuoti)
            );
            sezione.append(dettagliVuoti);
        }
    }

    risultato.replaceChildren(sezione);
    risultato.style.display = 'grid';
    aggiornaFreccia();
    salvaCronologia(String(codice), descrizione ? String(descrizione) : '');
}

function vicinoAlFondo() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
}

function aggiornaFreccia() {
    frecciaTeletrasporto.style.display = risultato.style.display === 'grid' && !vicinoAlFondo() ? 'flex' : 'none';
}

async function cerca() {
    const codice = input.value.trim();
    if (!codice) {
        erroreEl.textContent = 'Inserisci un codice articolo';
        input.focus();
        return;
    }

    erroreEl.textContent = '';
    risultato.replaceChildren();
    risultato.style.display = 'none';
    aggiornaFreccia();
    btn.disabled = true;
    btn.textContent = 'Cerco...';

    try {
        const res = await fetch(`/api/attributi/articolo/${encodeURIComponent(codice)}`);
        if (res.status === 404) {
            erroreEl.textContent = 'Articolo non trovato';
            input.focus();
            input.select();
            return;
        }
        if (!res.ok) throw new Error('Errore server');

        mostraRisultato(await res.json());
    } catch {
        erroreEl.textContent = 'Errore di connessione al server';
        input.focus();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Cerca';
    }
}

frecciaTeletrasporto.addEventListener('click', () => {
    document.getElementById('teletrasporto')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
btn.addEventListener('click', cerca);
input.addEventListener('keydown', event => {
    if (event.key === 'Enter') cerca();
});
window.addEventListener('scroll', aggiornaFreccia);
window.addEventListener('resize', aggiornaFreccia);

mostraCronologia();
