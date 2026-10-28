const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const codice = fs.readFileSync(path.join(__dirname, '../public/js/richieste.js'), 'utf8');
const attesa = () => new Promise(resolve => setImmediate(resolve));

function elemento() {
    return { textContent: '', value: '', checked: false, children: [], eventi: {}, style: {}, attributi: {}, dataset: {},
        append(figlio) { this.children.push(figlio); },
        replaceChildren(...figli) { this.children = figli; },
        addEventListener(nome, fn) { this.eventi[nome] = fn; },
        setAttribute(nome, valore) { this.attributi[nome] = valore; }, focus() { this.focused = true; },
        scrollIntoView() { this.scrolled = true; } };
}
function voce(id, extra = {}) {
    return { id, orario: '2026-10-27T08:00:00Z', ip: `10.50.0.${id}`, metodo: 'GET', percorso: '/api/stato',
        reparto: 'cava', stato: 200, durataMs: 15, byteCorpoRisposta: 1234, interrotta: false, ...extra };
}
function dati(log, extra = {}) {
    return { avvio: '2026-10-27T07:00:00Z', richiesteAvviate: log.length, inCorso: 0, piccoInCorso: 2,
        percorsi: [{ percorso: 'GET /api/stato', richieste: log.length, errori: 0, interrotte: 0,
            nonModificate: 1, byteCorpoRisposta: 1234, durataMediaMs: 15, durataMaxMs: 2000 }],
        limiteLog: 500, ultimoId: log[0]?.id || 0, logCompleto: true, richiesteRecenti: log,
        monitorReparti: { lettureSql: 1, risposteCache: 3, richiesteAccorpate: 2, erroriSql: 0, durataTotaleSqlMs: 100, durataMaxSqlMs: 100 }, ...extra };
}
const risposta = body => ({ ok: true, status: 200, json: async () => body });

async function pagina(fetch, hash = '') {
    const elementi = {};
    const eventi = {};
    let timer;
    const destinazioni = [];
    const eventiFinestra = {};
    const el = id => elementi[id] ||= elemento();
    el('richieste-auto').checked = true;
    el('richieste-filtro').value = 'tutte';
    el('richieste-metrica').value = 'richieste';
    const document = { hidden: false, getElementById: el, createElement: elemento,
        addEventListener(nome, fn) { eventi[nome] = fn; } };
    const context = vm.createContext({ document, Date, Map, AbortSignal, fetch, encodeURIComponent,
        window: { location: { hash, assign(url) { destinazioni.push(url); } }, addEventListener(nome, fn) { eventiFinestra[nome] = fn; } },
        setTimeout(fn, ms) { timer = { fn, ms }; return 1; }, clearTimeout() { timer = undefined; } });
    vm.runInContext(codice, context);
    await attesa();
    return { el: nome => el('richieste-' + nome), eventi, eventiFinestra, document, context, destinazioni, timer: () => timer,
        apriVista(vista) { context.window.location.hash = '#' + vista; eventiFinestra.hashchange(); } };
}

test('pagina log: paginazione, filtri e testo sicuro, senza chiamate API durante la ricerca', async () => {
    let chiamate = 0;
    const righe = Array.from({ length: 32 }, (_, i) => voce(32 - i));
    righe[0] = voce(32, { stato: 503, percorso: '<img onerror=alert(1)>', durataMs: 2000, byteCorpoRisposta: 1048576 });
    righe[1].interrotta = true;
    const p = await pagina(async () => { chiamate++; return risposta(dati(righe)); }, '#log');
    assert.equal(p.el('log').children.length, 25);
    assert.equal(p.el('pagina').textContent, 'Pagina 1 di 2');
    assert.equal(p.el('log').children[0].children[3].children[0].children[1].children[0].textContent,
        'GET <img onerror=alert(1)> · 1 richiesta');
    assert.equal(p.el('log').children[0].children[5].className, 'richiesta-errore');
    assert.equal(p.el('log').children[0].children[8].textContent, '2 s');
    assert.equal(p.el('log').children[0].children[9].textContent, '1 MiB');
    p.el('successiva').eventi.click();
    assert.equal(p.el('log').children.length, 7);
    assert.equal(p.el('successiva').disabled, true);
    for (const filtro of ['errori', 'lente', 'pesanti', 'interrotte']) {
        p.el('filtro').value = filtro;
        p.el('filtro').eventi.change();
        assert.equal(p.el('log').children.length, 1);
        assert.equal(p.el('pagina').textContent, 'Pagina 1 di 1');
    }
    p.el('filtro').value = 'tutte';
    p.el('cerca').value = '10.50.0.32';
    p.el('cerca').eventi.input();
    assert.equal(p.el('log').children.length, 1);
    p.el('cerca').value = 'assente';
    p.el('cerca').eventi.input();
    assert.match(p.el('log').children[0].children[0].textContent, /Nessun IP corrisponde/);
    assert.equal(chiamate, 1);
    assert.equal(p.el('sql-cache').textContent, '3');
});

test('pagina log: richieste incrementali, nessun duplicato, limite 500 e recupero da riavvio', async () => {
    const url = [];
    const p = await pagina(async richiesta => { url.push(richiesta); return risposta(dati([voce(2), voce(1)])); }, '#log');
    p.context.fetch = async richiesta => { url.push(richiesta); return risposta(dati([voce(3), voce(2)], { logCompleto: false })); };
    await p.el('aggiorna').eventi.click();
    assert.equal(url[1], '/api/diagnostica/rete?dopo=2&avvio=2026-10-27T07%3A00%3A00Z');
    assert.equal(p.el('log').children.length, 3);
    assert.equal(p.el('log').children[0].children[0].textContent, '10.50.0.3');
    p.context.fetch = async () => risposta(dati(Array.from({ length: 600 }, (_, i) => voce(603 - i)), { logCompleto: false }));
    await p.el('aggiorna').eventi.click();
    assert.match(p.el('conteggio').textContent, /500 richieste nel log/);
    p.context.fetch = async () => risposta(dati([voce(1)], { avvio: '2026-10-27T09:00:00Z' }));
    await p.el('aggiorna').eventi.click();
    assert.equal(p.el('log').children.length, 1);
    assert.match(p.el('stato').textContent, /Servizio riavviato/);
    p.context.fetch = async richiesta => { assert.equal(richiesta, '/api/diagnostica/rete?dopo=1&avvio=2026-10-27T09%3A00%3A00Z'); return risposta(dati([], { ultimoId: 1, logCompleto: false, avvio: '2026-10-27T09:00:00Z' })); };
    await p.el('aggiorna').eventi.click();
    assert.equal(p.el('log').children.length, 1);
});

test('pagina log: nessuna sovrapposizione, pausa automatica, errore conservativo e login', async () => {
    let completa;
    let chiamate = 0;
    const p = await pagina(() => { chiamate++; return new Promise(resolve => { completa = resolve; }); }, '#log');
    assert.equal(p.el('aggiorna').disabled, true);
    await p.el('aggiorna').eventi.click();
    assert.equal(chiamate, 1);
    completa(risposta(dati([voce(1)])));
    await attesa();
    const righe = p.el('log').children;
    assert.equal(p.timer().ms, 15000);
    p.document.hidden = true;
    p.eventi.visibilitychange();
    assert.equal(p.timer(), undefined);
    p.context.fetch = async () => { throw new Error('Offline'); };
    p.document.hidden = false;
    p.eventi.visibilitychange();
    await attesa();
    assert.equal(p.el('log').children, righe);
    assert.match(p.el('stato').textContent, /precedente aggiornamento/);
    assert.equal(p.timer().ms, 30000);
    p.el('auto').checked = false;
    p.el('auto').eventi.change();
    assert.equal(p.timer(), undefined);
    p.context.fetch = async () => risposta(dati([]));
    await p.el('aggiorna').eventi.click();
    assert.equal(p.timer(), undefined);
    assert.match(p.el('log').children[0].children[0].textContent, /Nessuna richiesta conclusa/);
    p.el('auto').checked = true;
    p.context.fetch = async () => ({ ok: false, status: 401 });
    await p.el('aggiorna').eventi.click();
    assert.match(p.destinazioni[0], /^\/autenticazione.html\?ritorno=%2FpaginaRichieste.html$/);
    assert.equal(p.timer(), undefined);
});

test('log accorpato per IP: conteggi, tempi, errori e percorsi, filtri senza perdere le altre richieste del computer', async () => {
    let chiamate = 0;
    const righe = [
        voce(9, { ip: '10.50.0.1', durataMs: 100, byteCorpoRisposta: 1000, orario: '2026-10-27T08:00:00Z' }),
        voce(8, { ip: '10.50.0.2', byteCorpoRisposta: 700 * 1024 }),
        voce(7, { ip: '10.50.0.1', stato: 503, durataMs: 2000, byteCorpoRisposta: 2048, orario: '2026-10-27T08:01:00Z' }),
        voce(6, { ip: '10.50.0.3', durataMs: 1100 }),
        voce(5, { ip: '10.50.0.2', byteCorpoRisposta: 700 * 1024 }),
        voce(4, { ip: '10.50.0.1', metodo: 'POST', percorso: '/api/presenza', reparto: 'tlingl', interrotta: true, durataMs: 0, byteCorpoRisposta: 0 })
    ];
    const p = await pagina(async () => { chiamate++; return risposta(dati(righe)); }, '#log');
    assert.equal(p.el('log').children.length, 3);
    const celle = p.el('log').children[0].children;
    assert.equal(celle[0].textContent, '10.50.0.1');
    assert.equal(celle[1].textContent, '3');
    assert.equal(celle[2].textContent, new Date('2026-10-27T08:01:00Z').toLocaleString('it-IT'));
    assert.equal(celle[4].textContent, 'cava, tlingl');
    assert.equal(celle[5].textContent, '1');
    assert.equal(celle[6].textContent, '1');
    assert.equal(celle[7].textContent, '700 ms');
    assert.equal(celle[8].textContent, '2 s');
    assert.equal(celle[9].textContent, '2,98 KiB');
    const dettagli = celle[3].children[0];
    assert.equal(dettagli.children[0].children[1].textContent, '2 percorsi');
    assert.equal(dettagli.children[1].children[0].textContent, 'GET /api/stato · 2 richieste');
    assert.equal(dettagli.children[1].children[1].textContent, 'POST /api/presenza · 1 richiesta');
    assert.match(p.el('conteggio').textContent, /3 IP · 6 richieste aggregate/);
    dettagli.open = true;
    dettagli.eventi.toggle();
    p.el('filtro').value = 'errori';
    p.el('filtro').eventi.change();
    assert.equal(p.el('log').children.length, 1);
    assert.equal(p.el('log').children[0].children[1].textContent, '3');
    assert.equal(p.el('log').children[0].children[3].children[0].open, true);
    p.el('filtro').value = 'lente';
    p.el('filtro').eventi.change();
    assert.equal(p.el('log').children.length, 2);
    p.el('filtro').value = 'pesanti';
    p.el('filtro').eventi.change();
    assert.match(p.el('log').children[0].children[0].textContent, /Nessun IP/);
    p.el('filtro').value = 'tutte';
    p.el('cerca').value = '/api/presenza';
    p.el('cerca').eventi.input();
    assert.equal(p.el('log').children.length, 1);
    assert.equal(p.el('log').children[0].children[1].textContent, '3');
    assert.equal(chiamate, 1);
    p.el('cerca').value = '';
    p.el('cerca').eventi.input();
    p.context.fetch = async () => risposta(dati([voce(10, { ip: '10.50.0.1' }), righe[0]], { logCompleto: false }));
    await p.el('aggiorna').eventi.click();
    assert.equal(p.el('log').children.length, 3);
    assert.equal(p.el('log').children[0].children[1].textContent, '4');
    assert.equal(p.el('log').children[0].children[3].children[0].open, true);
});

test('trend e classifiche: metriche locali, picchi evidenziati e IP sempre accorpati', async () => {
    let chiamate = 0;
    const righe = [
        voce(3, { ip: '10.50.0.1', byteCorpoRisposta: 100, durataMs: 10 }),
        voce(2, { ip: '10.50.0.2', stato: 503, byteCorpoRisposta: 1000, durataMs: 1000 }),
        voce(1, { ip: '10.50.0.1', byteCorpoRisposta: 100, durataMs: 20 })
    ];
    const percorsi = [
        { percorso: 'GET /normale', richieste: 10, byteCorpoRisposta: 100, durataMediaMs: 400, durataMaxMs: 700, errori: 0 },
        { percorso: 'GET /pesante', richieste: 3, byteCorpoRisposta: 1000, durataMediaMs: 1000, durataMaxMs: 2000, errori: 2 },
        { percorso: 'GET /altro', richieste: 2, byteCorpoRisposta: 200, durataMediaMs: 20, durataMaxMs: 40, errori: 1 }
    ];
    const campioni = [
        { inizio: '2026-10-27T08:00:00Z', richieste: 2, byteCorpoRisposta: 200, durataMediaMs: 100, durataMaxMs: 200, errori: 0, parziale: false },
        { inizio: '2026-10-27T08:01:00Z', richieste: 4, byteCorpoRisposta: 100, durataMediaMs: 20, durataMaxMs: 40, errori: 2, parziale: false },
        { inizio: '2026-10-27T08:02:00Z', richieste: 1, byteCorpoRisposta: 2000, durataMediaMs: 300, durataMaxMs: 300, errori: 0, parziale: true }
    ];
    const p = await pagina(async () => { chiamate++; return risposta(dati(righe, { percorsi, trend: { campioni } })); });
    assert.equal(p.el('trend-grafico').children.length, 3);
    assert.match(p.el('trend-grafico').children[1].className, /minuto-picco/);
    assert.equal(p.el('trend-grafico').children[0].children[0].style.height, '50%');
    assert.equal(p.el('trend-grafico').children[1].attributi['aria-pressed'], 'true');
    assert.match(p.el('trend-picco').textContent, /Picco 4 richieste/);
    assert.equal(p.el('sintesi-totale').textContent, '7');
    assert.equal(p.el('sintesi-byte').textContent, '2,25 KiB');
    assert.equal(p.el('sintesi-errori').textContent, '2');
    assert.equal(p.el('top-ip').children[0].children[0].textContent, '10.50.0.1');
    assert.equal(p.el('top-ip').children[0].children[1].textContent, '2 richieste');
    assert.equal(p.el('log').children.length, 0);
    assert.equal(p.el('percorsi').children.length, 0);
    p.apriVista('log');
    assert.equal(p.el('percorsi').children[0].children[0].textContent, 'GET /normale');
    assert.match(p.el('log').children[0].children[1].className, /richiesta-picco-valore/);
    p.apriVista('riepilogo');
    p.el('metrica').value = 'traffico';
    p.el('metrica').eventi.change();
    assert.equal(p.el('top-ip').children[0].children[0].textContent, '10.50.0.2');
    p.apriVista('log');
    assert.equal(p.el('log').children.length, 2);
    assert.equal(p.el('log').children[0].children[0].textContent, '10.50.0.2');
    assert.equal(p.el('percorsi').children[0].children[0].textContent, 'GET /pesante');
    assert.match(p.el('log').children[0].children[9].className, /richiesta-picco-valore/);
    p.apriVista('riepilogo');
    assert.match(p.el('trend-grafico').children[2].className, /minuto-picco/);
    p.el('trend-grafico').children[2].eventi.click();
    assert.match(p.el('trend-dettaglio').textContent, /intervallo parziale/);
    assert.match(p.el('trend-dettaglio').textContent, /1,95 KiB/);
    assert.equal(p.el('trend-grafico').children[2].attributi['aria-pressed'], 'true');
    p.el('metrica').value = 'tempo';
    p.el('metrica').eventi.change();
    assert.equal(p.el('top-ip').children[0].children[1].textContent, '1 s');
    p.apriVista('log');
    assert.match(p.el('log').children[0].children[7].className, /richiesta-picco-valore/);
    p.apriVista('riepilogo');
    p.el('metrica').value = 'errori';
    p.el('metrica').eventi.change();
    assert.equal(p.el('top-ip').children.length, 1);
    p.apriVista('log');
    assert.equal(p.el('percorsi').children[0].children[5].textContent, '2');
    p.apriVista('riepilogo');
    assert.match(p.el('trend-picco').textContent, /Picco 2 errori/);
    assert.equal(chiamate, 1);
    p.document.activeElement = p.el('trend-grafico').children[2];
    await p.timer().fn();
    assert.equal(p.el('trend-grafico').children[2].focused, true);
    assert.equal(p.el('trend-grafico').children[2].attributi['aria-pressed'], 'true');
});

test('trend: dati assenti, minuti a zero e azzeramento della selezione dopo riavvio', async () => {
    const p = await pagina(async () => risposta(dati([])));
    assert.match(p.el('trend-picco').textContent, /riavvia il servizio/);
    assert.equal(p.el('trend-grafico').children.length, 0);
    p.context.fetch = async () => risposta(dati([], { percorsi: [], trend: { campioni: [
        { inizio: '2026-10-27T08:00:00Z', richieste: 0, byteCorpoRisposta: 0, durataMediaMs: 0, durataMaxMs: 0, errori: 0, parziale: true }
    ] } }));
    await p.el('aggiorna').eventi.click();
    assert.match(p.el('trend-picco').textContent, /Nessuna attività/);
    assert.equal(p.el('trend-grafico').children[0].children[0].style.height, '0%');
    assert.doesNotMatch(p.el('trend-grafico').children[0].className, /minuto-picco/);
    assert.match(p.el('top-ip').children[0].textContent, /Nessuna attività/);
    p.context.fetch = async () => risposta(dati([], { avvio: '2026-10-27T09:00:00Z', trend: { campioni: [
        { inizio: '2026-10-27T09:00:00Z', richieste: 1, byteCorpoRisposta: 12, durataMediaMs: 10, durataMaxMs: 10, errori: 0, parziale: true }
    ] } }));
    await p.el('aggiorna').eventi.click();
    assert.match(p.el('stato').textContent, /Servizio riavviato/);
    assert.equal(p.el('trend-grafico').children[0].attributi['aria-pressed'], 'true');
    assert.match(p.el('trend-dettaglio').textContent, /1 richiesta/);
});

test('riepilogo semplice e log: cambio vista e ordinamento condiviso senza nuove richieste', async () => {
    let chiamate = 0;
    const p = await pagina(async () => { chiamate++; return risposta(dati(Array.from({ length: 6 }, (_, i) => voce(i + 1)))); });
    assert.equal(p.el('vista-riepilogo').hidden, false);
    assert.equal(p.el('vista-log').hidden, true);
    assert.equal(p.el('tab-riepilogo').attributi['aria-current'], 'page');
    assert.equal(p.el('top-ip').children.length, 3);
    p.context.window.location.hash = '#log';
    p.eventiFinestra.hashchange();
    assert.equal(p.el('vista-riepilogo').hidden, true);
    assert.equal(p.el('vista-log').hidden, false);
    assert.equal(p.el('tab-log').attributi['aria-current'], 'page');
    assert.equal(p.el('viste').scrolled, true);
    p.el('metrica-log').value = 'traffico';
    p.el('metrica-log').eventi.change();
    assert.equal(p.el('metrica').value, 'traffico');
    p.el('cerca').value = '10.50.0.1';
    p.el('cerca').eventi.input();
    assert.equal(p.el('log').children.length, 1);
    p.context.window.location.hash = '#riepilogo';
    p.eventiFinestra.hashchange();
    assert.equal(p.el('vista-log').hidden, true);
    assert.equal(p.el('vista-riepilogo').hidden, false);
    p.el('metrica').value = 'errori';
    p.el('metrica').eventi.change();
    assert.equal(p.el('metrica-log').value, 'errori');
    assert.equal(p.el('cerca').value, '10.50.0.1');
    assert.equal(chiamate, 1);
    const diretta = await pagina(async () => risposta(dati([])), '#log');
    assert.equal(diretta.el('vista-log').hidden, false);
    assert.equal(diretta.el('vista-riepilogo').hidden, true);
});

test('aggiornamenti: costruisce solo la vista aperta e mostra i dati recenti quando si cambia scheda', async () => {
    const p = await pagina(async () => risposta(dati([voce(1)])));
    assert.equal(p.el('log').children.length, 0);
    assert.equal(p.el('percorsi').children.length, 0);
    const computerRiepilogo = p.el('top-ip').children;
    p.apriVista('log');
    assert.equal(p.el('log').children.length, 1);
    assert.equal(p.el('log').children[0].children[1].textContent, '1');
    p.context.fetch = async () => risposta(dati([voce(2, { ip: '10.50.0.1' })], { logCompleto: false }));
    await p.el('aggiorna').eventi.click();
    assert.equal(p.el('log').children[0].children[1].textContent, '2');
    assert.equal(p.el('top-ip').children, computerRiepilogo);
    const righeLog = p.el('log').children;
    p.apriVista('riepilogo');
    assert.equal(p.el('top-ip').children[0].children[1].textContent, '2 richieste');
    p.context.fetch = async () => risposta(dati([voce(3, { ip: '10.50.0.1' })], { logCompleto: false }));
    await p.el('aggiorna').eventi.click();
    assert.equal(p.el('top-ip').children[0].children[1].textContent, '3 richieste');
    assert.equal(p.el('log').children, righeLog);
    p.apriVista('log');
    assert.equal(p.el('log').children[0].children[1].textContent, '3');
});

test('struttura HTML: grafico nel riepilogo, tabelle e SQL soltanto nella vista log nascosta', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/paginaRichieste.html'), 'utf8');
    const pila = [];
    const nodi = new Map();
    const vuoti = new Set(['meta', 'link', 'img', 'input', 'br', 'hr']);
    for (const tag of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        const [, chiusura, nome, attributi] = tag;
        if (chiusura) {
            assert.equal(pila.pop()?.nome, nome, `Chiusura non corrispondente: ${nome}`);
            continue;
        }
        const id = attributi.match(/\bid="([^"]+)"/)?.[1];
        if (id) nodi.set(id, { genitori: pila.map(v => v.id).filter(Boolean), attributi });
        if (!vuoti.has(nome)) pila.push({ nome, id });
    }
    assert.equal(pila.length, 0);
    assert.match(nodi.get('richieste-vista-log').attributi, /\bhidden\b/);
    assert.doesNotMatch(nodi.get('richieste-vista-riepilogo').attributi, /\bhidden\b/);
    for (const id of ['richieste-trend-grafico', 'richieste-top-ip', 'richieste-sintesi-totale']) {
        assert.ok(nodi.get(id).genitori.includes('richieste-vista-riepilogo'), id);
    }
    for (const id of ['richieste-log', 'richieste-percorsi', 'richieste-sql-query']) {
        assert.ok(nodi.get(id).genitori.includes('richieste-vista-log'), id);
        assert.ok(!nodi.get(id).genitori.includes('richieste-vista-riepilogo'), id);
    }
});
