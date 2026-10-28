const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function elemento() {
    return {
        children: [], textContent: '', style: {}, dataset: {}, classList: { add() {} },
        set innerHTML(valore) { this.children = []; },
        appendChild(figlio) { this.children.push(figlio); },
        insertRow() { const figlio = elemento(); this.children.push(figlio); return figlio; },
        insertCell() { const figlio = elemento(); this.children.push(figlio); return figlio; },
        addEventListener() {}, setAttribute() {}
    };
}

function risposta(dati = [], etag = '"v1"') {
    return { ok: true, status: 200, headers: new Headers({ ETag: etag, 'X-Dati-Aggiornati-Il': '2026-10-27T08:00:00Z' }),
        json: async () => ({ ok: true, reparto: 'Cava', dati }) };
}

async function pagina(fetch, hidden = false) {
    const elementi = {};
    const eventi = {};
    let timer;
    const document = {
        hidden,
        addEventListener: (nome, fn) => { eventi[nome] = fn; },
        getElementById: id => elementi[id] ||= elemento(),
        createElement: elemento, createTextNode: textContent => ({ textContent })
    };
    const context = vm.createContext({
        document, URLSearchParams, AbortSignal, Date, Headers,
        window: { location: { search: '?reparto=cava' } },
        console: { error() {} }, fetch,
        clearTimeout() { timer = undefined; }, setTimeout(fn, ms) { timer = { fn, ms }; return 1; }
    });
    await vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/reparto.js'), 'utf8'), context);
    return { context, document, elementi, eventi, timer: () => timer,
        aggiorna: () => vm.runInContext('caricaStato()', context) };
}

test('monitor: 304 evita parsing e ricostruzione, recupera dopo errore e mostra la data SQL', async () => {
    const richieste = [];
    const p = await pagina(async (url, opzioni) => { richieste.push(opzioni); return risposta([{ IMPIANTO: 'Forno', STATO: 'Iniziata' }]); });
    const primaRiga = p.elementi['tabella-dati'].children[0];
    assert.equal(p.timer().ms, 15000);
    assert.deepEqual(Object.keys(richieste[0].headers), []);
    assert.equal(p.elementi['ultimo-aggiornamento'].textContent,
        `Ultimo aggiornamento: ${new Date('2026-10-27T08:00:00Z').toLocaleTimeString('it-IT')}`);
    p.context.fetch = async (url, opzioni) => {
        assert.equal(opzioni.headers['If-None-Match'], '"v1"');
        return { ok: false, status: 304, headers: new Headers(), json() { throw new Error('304 non contiene JSON'); } };
    };
    await p.aggiorna();
    assert.equal(p.elementi['tabella-dati'].children[0], primaRiga);
    assert.equal(p.elementi['status-banner'].className, 'stato-ok');
    const invariata = p.context.fetch;
    p.context.fetch = async () => ({ ok: false, status: 503, json: async () => ({ errore: 'SQL offline' }) });
    await p.aggiorna();
    assert.equal(p.elementi['status-banner'].className, 'stato-errore');
    assert.equal(p.elementi['tabella-dati'].children[0], primaRiga);
    p.context.fetch = invariata;
    await p.aggiorna();
    assert.equal(p.elementi['status-banner'].className, 'stato-ok');
    assert.equal(p.elementi['errore-reparto-dettagli'].hidden, true);
    assert.equal(p.elementi['tabella-dati'].children[0], primaRiga);
    p.context.fetch = async () => risposta([{ IMPIANTO: 'Nuovo', STATO: 'Finita' }], '"v2"');
    await p.aggiorna();
    assert.notEqual(p.elementi['tabella-dati'].children[0], primaRiga);
    assert.equal(p.elementi['tabella-dati'].children[0].children[0].textContent, 'Nuovo');
});

test('monitor nascosto sospende il polling e la riapertura non sovrappone richieste', async () => {
    let richieste = 0;
    let completa;
    const p = await pagina(() => { richieste++; return new Promise(resolve => { completa = resolve; }); }, true);
    assert.equal(richieste, 0);
    assert.equal(p.timer(), undefined);
    p.document.hidden = false;
    p.eventi.visibilitychange();
    assert.equal(richieste, 1);
    await p.aggiorna();
    p.eventi.visibilitychange();
    assert.equal(richieste, 1);
    p.document.hidden = true;
    p.eventi.visibilitychange();
    completa(risposta());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.timer(), undefined);
    p.context.fetch = async () => { richieste++; return risposta(); };
    p.document.hidden = false;
    p.eventi.visibilitychange();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(richieste, 2);
    assert.equal(p.timer().ms, 15000);
});

test('monitor in errore rallenta i tentativi fino a 2 minuti e torna a 15 secondi al recupero', async () => {
    const p = await pagina(async () => { throw new TypeError('Rete non disponibile'); });
    assert.equal(p.timer().ms, 30000);
    await p.aggiorna();
    assert.equal(p.timer().ms, 60000);
    await p.aggiorna();
    assert.equal(p.timer().ms, 120000);
    await p.aggiorna();
    assert.equal(p.timer().ms, 120000);
    p.context.fetch = async () => risposta();
    await p.aggiorna();
    assert.equal(p.timer().ms, 15000);
    p.context.fetch = async () => ({ ok: false, status: 400, json: async () => ({ errore: 'Reparto sconosciuto', tipoErrore: 'reparto_invalido' }) });
    await p.aggiorna();
    assert.equal(p.timer(), undefined);
});
