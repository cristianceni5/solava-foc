// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: verificare query PLC, API, ordinamento, paginazione e dialog.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sorgente = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('la consultazione interroga PLC e limita i risultati ai 500 piu recenti', async () => {
    let query;
    const righe = [{ DATA_ORA: '2026-10-10', ARTICOLO: 'ART001' }];
    const mocks = {
        './pool': { getPool: async () => ({ request: () => ({ async query(sql) { query = sql; return { recordset: righe }; } }) }) },
        '../config/reparti': {}, '../utils/normalizzaArticolo': {}
    };
    const context = { module: { exports: {} }, process: { env: { DB_NOME_PLC: 'PLC_TEST' } }, require: nome => mocks[nome] };
    vm.runInNewContext(sorgente('db/queries.js'), context);
    assert.equal(await context.module.exports.getSalvataggiPrelav(), righe);
    assert.match(query, /SELECT TOP \(500\)\s+ID\s*,/);
    for (const campo of ['RICETTA_OMR', 'RICETTA_MES', 'TONN_TERRA', 'DATA_ORA']) {
        assert.ok(query.includes(campo), `Campo previsto nella query: ${campo}`);
    }
    assert.match(query, /FROM \[PLC_TEST\]\.\[dbo\]\.\[SLV_T_SALVATAGGI_PRELAV\]/);
    assert.match(query, /ORDER BY DATA_ORA DESC/);
});

test('endpoint salvataggi restituisce record, limite e 503 quando SQL fallisce', async () => {
    let handler;
    let offline = false;
    const context = { module: { exports: {} }, console: { error() {} }, require(nome) {
        if (nome === 'express') return { Router: () => ({ get(url, fn) { assert.equal(url, '/api/salvataggi/prelavorazione'); handler = fn; } }) };
        return { async getSalvataggiPrelav() { if (offline) throw new Error('SQL offline'); return [{ ARTICOLO: 'ART001' }]; } };
    } };
    vm.runInNewContext(sorgente('routes/salvataggi.js'), context);
    const res = { code: 200, set(nome, valore) { this[nome] = valore; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({}, res);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.dati[0].ARTICOLO, 'ART001');
    assert.equal(res.body.limite, 500);
    assert.equal(res['Cache-Control'], 'no-store');
    offline = true;
    await handler({}, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.ok, false);
});

class Elemento {
    constructor() {
        this.children = [];
        this.dataset = {};
        this.value = '';
        this.events = {};
        this.textContent = '';
        this.attributes = {};
        this.classList = { values: new Set(), add: nome => this.classList.values.add(nome) };
        this.open = false;
    }
    append(...figli) { this.children.push(...figli); }
    replaceChildren(...figli) { this.children = figli; }
    addEventListener(nome, handler) { this.events[nome] = handler; }
    setAttribute(nome, valore) { this.attributes[nome] = valore; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
}

async function paginaConDati(dati, vista = 'tabella', recherche = '') {
    const elementi = new Map();
    const document = { body: { dataset: { vista } }, addEventListener() {}, getElementById(id) {
        if (!elementi.has(id)) elementi.set(id, new Elemento());
        return elementi.get(id);
    }, createElement: () => new Elemento() };
    let errore = false;
    const context = { document, Date, URLSearchParams, AbortSignal, window: { location: { search: recherche }, history: { replaceState() {} } }, fetch: async () => {
        if (errore) throw new Error('Server offline');
        return { ok: true, json: async () => ({ ok: true, dati, limite: 500 }) };
    } };
    vm.runInNewContext(sorgente('public/js/reportControlli.js'), context);
    vm.runInNewContext(sorgente('public/js/salvataggi.js'), context);
    await new Promise(resolve => setImmediate(resolve));
    return { get: id => document.getElementById(id), offline() { errore = true; } };
}

test('pagina salvataggi: colonne dinamiche, pagine e valori resi come testo', async () => {
    const dati = Array.from({ length: 31 }, (_, i) => ({ DATA_ORA: '2026-10-10T10:30:00.000Z', ARTICOLO: `ART${i}`, STATO: 'Registrato', ALTRO_CAMPO: i === 30 ? '<img onerror=alert(1)>' : 'test' }));
    const { get } = await paginaConDati(dati);
    assert.equal(get('righe-salvataggi').children.length, 25);
    assert.equal(get('pagina-precedente').disabled, true);
    assert.equal(get('numero-pagina').textContent, 'Pagina 1 di 2');
    get('pagina-successiva').events.click();
    assert.equal(get('righe-salvataggi').children.length, 6);
    assert.equal(get('pagina-successiva').disabled, true);
    const riga = get('righe-salvataggi').children[5];
    assert.equal(get('intestazione-salvataggi').children[0].children.length, 3);
    assert.equal(riga.children[1].textContent, 'ART30');
    assert.equal(riga.children[2].textContent, '<img onerror=alert(1)>');
    assert.equal(riga.children[0].textContent, '10/10/2026 10:30:00');
    assert.equal(get('salvataggi-vuoto').hidden, true);
    assert.equal(get('paginazione-salvataggi').hidden, false);
});

test('salvataggi ordinati dal piu recente senza selettore di ordinamento', async () => {
    const dati = [
        { DATA_ORA: '2026-10-08T08:00:00.000Z', ARTICOLO: 'VECCHIO' },
        { DATA_ORA: '2026-10-10T10:00:00.000Z', ARTICOLO: 'NUOVO' },
        { DATA_ORA: '2026-10-09T09:00:00.000Z', ARTICOLO: 'MEDIO' }
    ];
    const { get } = await paginaConDati(dati);
    const righe = () => get('righe-salvataggi').children;

    assert.equal(righe()[0].children[1].textContent, 'NUOVO');
    assert.equal(get('intestazione-salvataggi').children[0].children[0].attributes['aria-sort'], 'descending');
    assert.equal(get('intestazione-salvataggi').children[0].children[0].textContent, 'DATA ORA');
    assert.equal(righe()[1].children[1].textContent, 'MEDIO');
    assert.equal(righe()[2].children[1].textContent, 'VECCHIO');
    assert.equal(righe().length, 3);
});

test('riga accessibile apre il dialog con tutte le colonne, anche quelle escluse', async () => {
    const { get } = await paginaConDati([{ DATA_ORA: '2026-10-10T10:30:00.000Z', ARTICOLO: 'ART001', STATO: 'Registrato', OPERATORE: 'Mario', 'QTA GG': 12 }]);
    const riga = get('righe-salvataggi').children[0];
    const dialog = get('anteprima-salvataggio');
    assert.equal(riga.classList.values.has('riga-cliccabile'), true);
    assert.equal(riga.tabIndex, 0);
    assert.equal(riga.attributes.role, 'button');
    assert.equal(riga.attributes['aria-haspopup'], 'dialog');
    assert.equal(riga.children.length, 2);
    riga.events.click();
    assert.equal(dialog.open, true);
    const campi = get('anteprima-salvataggio-valori').children;
    assert.equal(campi.length, 5);
    assert.equal(campi[2].children[0].textContent, 'STATO');
    assert.equal(campi[2].children[1].textContent, 'Registrato');
    get('chiudi-anteprima-salvataggio').events.click();
    assert.equal(dialog.open, false);
    let prevented = false;
    riga.events.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(dialog.open, true);
    dialog.events.click({ target: dialog });
    assert.equal(dialog.open, false);
    riga.events.keydown({ key: ' ', preventDefault() {} });
    assert.equal(dialog.open, true);
    dialog.close();
    riga.events.keydown({ key: 'Tab', preventDefault() { throw new Error('Tab non deve aprire il dialog'); } });
    assert.equal(dialog.open, false);
});

test('aggiornamento fallito conserva i risultati precedenti e permette di riprovare', async () => {
    const { get, offline } = await paginaConDati([{ ARTICOLO: 'ART001' }]);
    offline();
    await get('aggiorna-salvataggi').events.click();
    assert.equal(get('righe-salvataggi').children.length, 1);
    assert.match(get('stato-salvataggi').textContent, /precedente caricamento/);
    assert.equal(get('aggiorna-salvataggi').disabled, false);
});

test('tabella vuota mostra uno stato dedicato senza paginazione', async () => {
    const { get } = await paginaConDati([]);
    assert.equal(get('contenitore-salvataggi').hidden, true);
    assert.equal(get('paginazione-salvataggi').hidden, true);
    assert.equal(get('salvataggi-vuoto').textContent, 'Nessun salvataggio disponibile.');
});

test('report raggruppa tutti i campi, conserva gli zeri e include i campi nuovi', async () => {
    const riga = { ID: 2, DATA_ORA: '2026-10-08T07:41:28.123Z', RICETTA_OMR: 1, RICETTA_MES: 1,
        ORE_IMP_ACCESO_L1: 100, ORE_IMP_LAVORAZIONE_L1: 80, ORE_IMP_ACCESO_L2: 120,
        ORE_IMP_LAVORAZIONE_L2: 90, TONN_TERRA: 619, HZ_CASSONE_1: 2, HZ_CASSONE_2: 0,
        HZ_CASSONE_3: 34, HZ_CASSONE_4: 17, HZ_CASSONE_5: 0, NUOVO_CAMPO: '<script>test</script>' };
    const { get } = await paginaConDati([riga], 'report');
    assert.equal(get('report-salvataggi').hidden, false);
    assert.equal(get('contenitore-salvataggi').hidden, true);
    assert.equal(get('paginazione-salvataggi').hidden, true);
    const cards = get('report-griglia').children;
    assert.equal(cards.length, 6);
    const campi = cards.flatMap(card => card.children[1].children);
    assert.equal(campi.length, Object.keys(riga).length);
    assert.equal(cards[4].children[1].children[1].children[1].textContent, '0');
    assert.equal(cards[5].children[1].children[0].children[1].textContent, '<script>test</script>');
    assert.equal(get('report-precedente').disabled, true);
    assert.equal(get('report-successivo').disabled, true);
});

test('report apre il record richiesto e permette di passare al riepilogo del giorno seguente', async () => {
    const dati = [{ ID: 1, DATA_ORA: '2026-10-08T08:00:00' }, { ID: 2, DATA_ORA: '2026-10-09T08:00:00' }];
    const { get } = await paginaConDati(dati, 'report', '?id=1');
    assert.equal(get('report-titolo').textContent, 'Salvataggio - 1');
    get('report-successivo').events.click();
    assert.equal(get('report-data').textContent, '09/10/2026');
    assert.equal(get('report-titolo').textContent, 'Riepilogo giornaliero');
    assert.equal(get('report-successivo').disabled, true);
    get('report-eventi').children[1].events.click();
    assert.equal(get('vista-report').href, 'paginaReportSalvataggi.html?id=2');
});

test('ritorno alla tabella apre la pagina del salvataggio scelto nel report', async () => {
    const dati = Array.from({ length: 31 }, (_, ID) => ({ ID, DATA_ORA: '2026-10-08T08:00:00' }));
    const { get } = await paginaConDati(dati, 'tabella', '?id=30');
    assert.equal(get('numero-pagina').textContent, 'Pagina 2 di 2');
    assert.equal(get('vista-report').href, 'paginaReportSalvataggi.html?id=30');
    assert.equal(get('righe-salvataggi').children[5].classList.values.has('riga-selezionata'), true);
});

test('report senza risultati o con ID assente mostra uno stato coerente', async () => {
    const vuota = await paginaConDati([], 'report');
    assert.equal(vuota.get('report-salvataggi').hidden, true);
    assert.equal(vuota.get('salvataggi-vuoto').hidden, false);
    const esistente = await paginaConDati([{ ID: 2, DATA_ORA: '2026-10-08T08:00:00' }], 'report', '?id=999');
    assert.equal(esistente.get('vista-report').href, 'paginaReportSalvataggi.html?giorno=2026-10-08');
});

test('ricette verdi se coincidono, gialle se diverse anche nel riepilogo giornaliero', async () => {
    const dati = [
        { ID: 1, DATA_ORA: '2026-10-08T08:00:00', RICETTA_OMR: 1, RICETTA_MES: 1 },
        { ID: 2, DATA_ORA: '2026-10-08T09:00:00', RICETTA_OMR: 1, RICETTA_MES: 2 }
    ];
    const tabella = await paginaConDati(dati);
    assert.equal(tabella.get('righe-salvataggi').children[0].children[2].dataset.ricette, 'diverse');
    assert.equal(tabella.get('righe-salvataggi').children[1].children[2].dataset.ricette, 'coerenti');
    const report = await paginaConDati(dati, 'report');
    const esiti = () => report.get('report-griglia').children[0].children[1].children
        .filter(campo => campo.dataset.campo.startsWith('RICETTA_')).map(campo => campo.dataset.ricette);
    assert.deepEqual(esiti(), ['diverse', 'diverse']);
    report.get('report-eventi').children[2].events.click();
    assert.deepEqual(esiti(), ['coerenti', 'coerenti']);
});

test('riepilogo giornaliero usa intervalli dei contatori e conserva tutti gli eventi', async () => {
    const dati = [
        { ID: 1, DATA_ORA: '2026-10-08T08:00:00', TONN_TERRA: 100, HZ_CASSONE_1: 0 },
        { ID: 2, DATA_ORA: '2026-10-08T18:00:00', TONN_TERRA: 150, HZ_CASSONE_1: 20 },
        { ID: 3, DATA_ORA: '2026-10-09T08:00:00', TONN_TERRA: 999 }
    ];
    const { get } = await paginaConDati(dati, 'report', '?giorno=2026-10-08');
    const cards = get('report-griglia').children;
    assert.equal(cards.find(c => c.children[0].textContent === 'Produzione').children[1].children[0].children[1].textContent, '100 – 150');
    assert.equal(get('report-eventi').children.length, 3);
    assert.equal(get('report-eventi').children[0].textContent, 'Riepilogo - 2');
    get('report-eventi').children[1].events.click();
    assert.equal(get('report-titolo').textContent, 'Salvataggio - 2');
    get('report-eventi').children[0].events.click();
    assert.equal(get('report-titolo').textContent, 'Riepilogo giornaliero');
    const giorno8 = get('calendario-giorni').children.find(c => c.attributes['aria-label'] === '08/10/2026, 2 salvataggi');
    assert.equal(giorno8.disabled, false);
    const giorno9 = get('calendario-giorni').children.find(c => c.attributes['aria-label'] === '09/10/2026, 1 salvataggi');
    giorno9.events.click();
    assert.equal(get('report-data').textContent, '09/10/2026');
    assert.equal(get('report-eventi').children.length, 2);
    assert.equal(get('calendario-report').hidden, true);
});
