const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function elemento() {
    return {
        textContent: '', children: [], attributi: {}, disabled: false, eventi: {},
        append(figlio) { this.children.push(figlio); },
        replaceChildren(...figli) { this.children = figli; },
        setAttribute(nome, valore) { this.attributi[nome] = valore; },
        addEventListener(nome, azione) { this.eventi[nome] = azione; }
    };
}

test('PC UI: evita richieste sovrapposte, conserva dati su errore e gestisce vuoto e sessione scaduta', async () => {
    const elementi = Object.fromEntries(['stato-pc', 'elenco-pc', 'aggiorna-pc', 'excel-pc', 'ultimo-caricamento-pc', 'conteggio-pc', 'paginazione-pc', 'pc-precedente', 'pc-successiva', 'pc-numero-pagina', 'errore-pc-dettagli', 'errore-pc-raw'].map(id => [id, elemento()]));
    let risolvi;
    let chiamate = 0;
    const destinazioni = [];
    const esportazioni = [];
    const context = vm.createContext({
        document: { addEventListener() {}, getElementById: id => elementi[id], createElement: elemento },
        window: { addEventListener() {}, setTimeout() {}, setInterval() {}, location: { assign: url => destinazioni.push(url) } },
        AbortSignal, Date,
        exportTableToExcel: (...args) => esportazioni.push(args),
        fetch: () => { chiamate++; return new Promise(resolve => { risolvi = resolve; }); }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/pcConnessi.js'), 'utf8'), context);
    const prima = vm.runInContext('caricaPc()', context);
    await vm.runInContext('caricaPc()', context);
    assert.equal(chiamate, 1);
    assert.equal(elementi['aggiorna-pc'].disabled, true);
    risolvi({ ok: true, status: 200, json: async () => [{
        ip: '::1', connesso: true, pagina: '<img src=x>',
        primoAccesso: '2026-10-23T08:00:00Z', ultimoContatto: '2026-10-23T09:00:00Z'
    }] });
    await prima;
    const righe = elementi['elenco-pc'].children;
    assert.equal(righe.length, 1);
    assert.equal(righe[0].children[0].textContent, '::1 (Localhost)');
    assert.equal(elementi['excel-pc'].disabled, false);
    elementi['excel-pc'].eventi.click();
    assert.deepEqual(esportazioni[0].slice(0, 2), ['tabella-pc', 'computerConnessi']);
    assert.equal(esportazioni[0][2].length, 2);
    assert.equal(righe[0].children[1].textContent, '—');
    assert.equal(righe[0].children[3].textContent, '<img src=x>');
    assert.equal(elementi['aggiorna-pc'].disabled, false);
    assert.equal(elementi['elenco-pc'].attributi['aria-busy'], 'false');
    context.fetch = async () => { throw new Error('Offline'); };
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['elenco-pc'].children, righe);
    assert.match(elementi['stato-pc'].textContent, /Dati precedenti/);
    context.fetch = async () => ({ ok: true, status: 200, json: async () => [] });
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['elenco-pc'].children[0].children[0].colSpan, 7);
    assert.match(elementi['elenco-pc'].children[0].children[0].textContent, /Nessun PC/);
    assert.equal(elementi['excel-pc'].disabled, true);
    elementi['excel-pc'].eventi.click();
    assert.equal(esportazioni.length, 1);
    context.fetch = async () => ({ ok: false, status: 401 });
    await vm.runInContext('caricaPc()', context);
    assert.match(destinazioni[0], /^\/autenticazione.html\?ritorno=/);
    const pc = Array.from({ length: 52 }, (_, indice) => ({
        ip: `192.168.1.${indice + 1}`, connesso: indice < 3, pagina: '/index.html',
        primoAccesso: '2026-10-23T08:00:00Z', ultimoContatto: '2026-10-23T09:00:00Z'
    }));
    context.fetch = async () => ({ ok: true, status: 200, json: async () => pc });
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['elenco-pc'].children.length, 25);
    assert.equal(elementi['pc-precedente'].disabled, true);
    assert.equal(elementi['paginazione-pc'].hidden, false);
    assert.match(elementi['conteggio-pc'].textContent, /3 connessi · 52 registrati/);
    elementi['pc-successiva'].eventi.click();
    assert.equal(elementi['elenco-pc'].children[0].children[0].textContent, '192.168.1.26');
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['pc-numero-pagina'].textContent, 'Pagina 2 di 3');
    elementi['excel-pc'].eventi.click();
    assert.equal(esportazioni.at(-1)[2].length, 53);
    elementi['pc-successiva'].eventi.click();
    assert.equal(elementi['elenco-pc'].children.length, 2);
    assert.equal(elementi['pc-successiva'].disabled, true);
    context.fetch = async () => ({ ok: true, status: 200, json: async () => pc.slice(0, 2) });
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['pc-numero-pagina'].textContent, 'Pagina 1 di 1');
    assert.equal(elementi['paginazione-pc'].hidden, true);
    context.fetch = async () => ({ ok: false, status: 500, json: async () => ({ errore: 'Registro non disponibile', erroreRaw: '<errore JSON>' }) });
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['stato-pc'].className, 'errore');
    assert.match(elementi['stato-pc'].textContent, /Registro non disponibile/);
    assert.equal(elementi['errore-pc-raw'].textContent, '<errore JSON>');
    assert.equal(elementi['errore-pc-dettagli'].hidden, false);
    context.fetch = async () => ({ ok: true, status: 200, json: async () => [{ ...pc[0], reparto: 'cava', nomeReparto: 'Prelavorazione - Cava' }] });
    await vm.runInContext('caricaPc()', context);
    assert.equal(elementi['stato-pc'].className, '');
    assert.equal(elementi['errore-pc-dettagli'].hidden, true);
    assert.equal(elementi['elenco-pc'].children[0].children[4].textContent, 'Prelavorazione - Cava');
});

test('report PC carica la giornata scelta ed esporta lo storico anziché lo stato attuale', async () => {
    const elementi = {};
    const el = id => elementi[id] ||= { ...elemento(), value: '' };
    const storico = [{ ip: '192.168.1.5', primoContatto: '2026-10-23T08:00:00Z', ultimoContatto: '2026-10-23T09:00:00Z', secondiOsservati: 60, rilevazioni: 3, usi: [] }];
    const esportazioni = [], report = [];
    const richieste = [];
    let fallisci = false;
    const contesto = vm.createContext({
        document: { addEventListener() {}, body: { dataset: { vista: 'report' } }, getElementById: el, createElement: elemento },
        window: { addEventListener() {}, setTimeout() {}, setInterval() {}, location: { assign() {} } },
        AbortSignal, Date, AnalisiReport: require('../public/js/analisiReport'),
        creaReportTabella: () => ({ aggiorna: dati => report.push(dati) }),
        creaCalendarioReport: () => ({ aggiorna() {} }),
        exportTableToExcel: (...args) => esportazioni.push(args),
        fetch: async url => {
            richieste.push(url);
            if (url.includes('/report')) {
                if (fallisci) throw new Error('Offline');
                return { ok: true, json: async () => ({ giorno: '2026-10-23', giorni: ['2026-10-23', '2026-10-22'], dati: storico }) };
            }
            return { ok: true, json: async () => [] };
        }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/pcConnessi.js'), 'utf8'), contesto);
    await vm.runInContext('caricaPc()', contesto);
    assert.equal(richieste.length, 1);
    assert.equal(richieste[0], '/api/pc-connessi/report');
    assert.equal(el('pc-giorno').value, '2026-10-23');
    assert.equal(report.at(-1)[0].ip, '192.168.1.5');
    assert.equal(el('excel-pc').disabled, false);
    el('excel-pc').eventi.click();
    assert.equal(esportazioni[0][1], 'usoFOP-2026-10-23');
    assert.equal(esportazioni[0][2][1][0], '192.168.1.5');
    fallisci = true;
    el('pc-giorno').value = '2026-10-22';
    await vm.runInContext('caricaPc()', contesto);
    assert.equal(el('pc-giorno').value, '2026-10-23');
    assert.equal(el('excel-pc').disabled, true);
});

test('PC nascosti: niente caricamenti iniziali o polling, aggiornamento al ritorno in primo piano', async () => {
    const elementi = {};
    const eventi = {};
    const eventiFinestra = {};
    let polling;
    let chiamate = 0;
    const document = { hidden: true, getElementById: id => elementi[id] ||= elemento(), createElement: elemento,
        addEventListener(nome, fn) { eventi[nome] = fn; } };
    const context = vm.createContext({ document, AbortSignal, Date,
        window: { addEventListener(nome, fn) { eventiFinestra[nome] = fn; }, setTimeout() {}, setInterval(fn) { polling = fn; } },
        fetch: async () => { chiamate++; return { ok: true, json: async () => [] }; } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/pcConnessi.js'), 'utf8'), context);
    eventiFinestra['fop-presenza']();
    polling();
    assert.equal(chiamate, 0);
    document.hidden = false;
    eventi.visibilitychange();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(chiamate, 1);
    document.hidden = true;
    polling();
    assert.equal(chiamate, 1);
    document.hidden = false;
    polling();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(chiamate, 2);
});
