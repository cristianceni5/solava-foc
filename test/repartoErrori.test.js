const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function elemento() {
    return {
        children: [], textContent: '', style: {}, dataset: {}, classList: { add() {} },
        appendChild(figlio) { this.children.push(figlio); },
        insertRow() { const figlio = elemento(); this.children.push(figlio); return figlio; },
        insertCell() { const figlio = elemento(); this.children.push(figlio); return figlio; },
        addEventListener() {}
    };
}

test('monitor reparto: errore rosso, raw come testo, recupero e stato vuoto senza errore', async () => {
    const elementi = {};
    const document = {
        addEventListener() {},
        getElementById: id => elementi[id] ||= elemento(),
        createElement: elemento, createTextNode: textContent => ({ textContent })
    };
    const contesto = vm.createContext({
        document, URLSearchParams, AbortSignal, Date,
        window: { location: { search: '?reparto=cava' } },
        console: { error() {} }, clearTimeout() {}, setTimeout() {},
        fetch: async () => ({ ok: false, status: 503, json: async () => ({
            errore: 'Il database non risponde', erroreRaw: '<sql>timeout</sql>', tipoErrore: 'db_non_disponibile'
        }) })
    });
    await vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/reparto.js'), 'utf8'), contesto);
    assert.equal(elementi['status-banner'].className, 'stato-errore');
    assert.equal(elementi['risposta'].textContent, 'Il database non risponde');
    assert.equal(elementi['errore-reparto-raw'].textContent, '<sql>timeout</sql>');
    assert.equal(elementi['errore-reparto-dettagli'].hidden, false);
    contesto.fetch = async () => ({ ok: true, headers: new Headers(), json: async () => ({ ok: true, reparto: 'Cava', dati: [] }) });
    await vm.runInContext('caricaStato()', contesto);
    assert.equal(elementi['status-banner'].className, 'stato-vuoto');
    assert.equal(elementi['errore-reparto-dettagli'].hidden, true);
    assert.equal(elementi['errore-reparto-raw'].textContent, '');
    assert.equal(elementi['tabella-dati'].children[0].children[0].textContent, 'Nessuna lavorazione disponibile.');
    contesto.fetch = async () => ({ ok: false, json: async () => ({ errore: 'Reparto sconosciuto', tipoErrore: 'reparto_invalido' }) });
    await vm.runInContext('caricaStato()', contesto);
    assert.equal(elementi.stato.children.at(-1).textContent.trim(), 'Reparto non valido');
});

test('anagrafica reparti rifiuta identificativi ereditati e query strutturate', () => {
    const { getReparto } = require('../config/reparti');
    assert.equal(getReparto('constructor'), null);
    assert.equal(getReparto(['cava']), null);
    assert.ok(getReparto('cava'));
});
