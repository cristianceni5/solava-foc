const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const { EventEmitter } = require('node:events');
const { creaLetturaReparti } = require('../services/statoReparto');
const { creaDiagnosticaRete } = require('../middleware/diagnosticaRete');
const { getReparto } = require('../config/reparti');
const sorgente = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('20 monitor condividono la lettura, la cache scade e i reparti restano separati', async () => {
    let ora = 0;
    let query = 0;
    let completa;
    const servizio = creaLetturaReparti({ orologio: () => ora, query: () => {
        query++;
        return new Promise(resolve => { completa = resolve; });
    } });
    const richieste = Array.from({ length: 20 }, () => servizio.leggi('cava'));
    assert.equal(query, 1);
    ora = 50;
    completa([{ IMPIANTO: 'Test', STATO: 'Iniziata' }]);
    const risultati = await Promise.all(richieste);
    assert.ok(risultati.every(r => r === risultati[0]));
    assert.equal(risultati[0].aggiornatoIl, new Date(50).toISOString());
    ora = 15049;
    assert.equal(await servizio.leggi('cava'), risultati[0]);
    assert.equal(query, 1);
    const altro = servizio.leggi('tlingl');
    completa([]);
    assert.match((await altro).corpo, /Trafila Lingl/);
    ora = 15050;
    const scaduta = servizio.leggi('cava');
    completa([{ IMPIANTO: 'Test', STATO: 'Iniziata' }]);
    assert.equal((await scaduta).etag, risultati[0].etag);
    assert.equal(query, 3);
    assert.equal(servizio.statistiche().richiesteAccorpate, 19);
    assert.equal(servizio.statistiche().risposteCache, 1);
    assert.equal(servizio.statistiche().durataMaxSqlMs, 50);
    for (const id of ['constructor', ['cava'], 'ignoto']) await assert.rejects(servizio.leggi(id));
    assert.equal(query, 3);
});

test('SQL offline: nessun dato vecchio dato per aggiornato, errori accorpati e recupero dopo 15 secondi', async () => {
    let ora = 0;
    let query = 0;
    const servizio = creaLetturaReparti({ orologio: () => ora, query: async () => {
        if (++query === 2) throw new Error('SQL offline');
        return [];
    } });
    await servizio.leggi('cava');
    ora = 15000;
    const errori = await Promise.allSettled(Array.from({ length: 20 }, () => servizio.leggi('cava')));
    assert.ok(errori.every(r => r.status === 'rejected' && r.reason.message === 'SQL offline'));
    ora = 29999;
    await assert.rejects(servizio.leggi('cava'), /SQL offline/);
    assert.equal(query, 2);
    ora = 30000;
    assert.ok(await servizio.leggi('cava'));
    assert.equal(query, 3);
    assert.equal(servizio.statistiche().erroriSql, 1);
});

test('cache reparto: anche un errore immediato libera la richiesta e permette il recupero', async () => {
    let ora = 0;
    let tentativi = 0;
    const servizio = creaLetturaReparti({ orologio: () => ora, query() {
        tentativi++;
        if (tentativi === 1) throw new Error('Errore immediato');
        return [];
    } });
    await assert.rejects(servizio.leggi('cava'), /Errore immediato/);
    await assert.rejects(servizio.leggi('cava'), /Errore immediato/);
    assert.equal(tentativi, 1);
    ora = 15000;
    assert.ok(await servizio.leggi('cava'));
    assert.equal(tentativi, 2);
});

async function avvia(t, app) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

test('API reparto: ETag e 304 senza corpo, dati modificati e SQL offline', async t => {
    let ora = 0;
    let dati = [{ IMPIANTO: 'Forno', 'QTA TOT': 10 }];
    let offline = false;
    const servizio = creaLetturaReparti({ orologio: () => ora, query: async () => {
        if (offline) throw new Error('SQL offline');
        return dati;
    } });
    const statoReparto = require('../services/statoReparto');
    const leggiOriginale = statoReparto.leggi;
    statoReparto.leggi = servizio.leggi;
    t.after(() => { statoReparto.leggi = leggiOriginale; });
    const app = express();
    app.use(require('../routes/stato'));
    const base = await avvia(t, app);
    const prima = await fetch(base + '/api/stato?reparto=cava');
    assert.equal(prima.status, 200);
    assert.equal((await prima.json()).dati[0]['QTA TOT'], 10);
    const etag = prima.headers.get('etag');
    assert.ok(etag);
    assert.equal(prima.headers.get('x-dati-aggiornati-il'), new Date(0).toISOString());
    const invariata = await fetch(base + '/api/stato?reparto=cava', { cache: 'no-store', headers: { 'If-None-Match': etag } });
    assert.equal(invariata.status, 304);
    assert.equal(await invariata.text(), '');
    assert.equal((await fetch(base + '/api/stato?reparto=cava', { headers: { 'If-None-Match': `"altro", W/${etag}` } })).status, 304);
    assert.equal((await fetch(base + '/api/stato?reparto=cava', { headers: { 'If-None-Match': '"diverso"' } })).status, 200);
    ora = 15000;
    dati = [{ IMPIANTO: 'Forno', 'QTA TOT': 11 }];
    const cambiata = await fetch(base + '/api/stato?reparto=cava', { headers: { 'If-None-Match': etag } });
    assert.equal(cambiata.status, 200);
    assert.notEqual(cambiata.headers.get('etag'), etag);
    assert.equal((await cambiata.json()).dati[0]['QTA TOT'], 11);
    offline = true;
    ora = 30000;
    const errore = await fetch(base + '/api/stato?reparto=cava', { headers: { 'If-None-Match': '*' } });
    assert.equal(errore.status, 503);
    assert.equal((await errore.json()).ok, false);
    assert.equal((await fetch(base + '/api/stato?reparto=ignoto')).status, 400);
});

test('diagnostica conta corpi UTF-8, streaming, file statici, 304 ed errori senza contare due volte', async t => {
    const diagnostica = creaDiagnosticaRete();
    const app = express();
    app.use(diagnostica.middleware);
    app.get('/json/:id', (req, res) => res.json({ testo: 'città' }));
    app.get('/stream', (req, res) => { res.write('città'); res.end(Buffer.from('123')); });
    app.get('/invariata', (req, res) => res.status(304).end());
    app.get('/errore', (req, res) => res.status(503).send('offline'));
    app.use(express.static(path.join(__dirname, '../public')));
    const base = await avvia(t, app);
    const json = await fetch(base + '/json/123?segreto=test');
    const byteJson = (await json.arrayBuffer()).byteLength;
    await (await fetch(base + '/json/456')).arrayBuffer();
    await (await fetch(base + '/stream')).arrayBuffer();
    await fetch(base + '/invariata');
    await (await fetch(base + '/errore')).text();
    await fetch(base + '/json/123', { method: 'HEAD' });
    const file = await fetch(base + '/assets/logo-solava-rid.png');
    const byteFile = (await file.arrayBuffer()).byteLength;
    const dati = diagnostica.statistiche();
    assert.equal(dati.richiesteAvviate, 7);
    assert.equal(dati.inCorso, 0);
    const voce = percorso => dati.percorsi.find(v => v.percorso === percorso);
    assert.equal(voce('GET /json/:id').richieste, 2);
    assert.equal(voce('GET /json/:id').byteCorpoRisposta, byteJson * 2);
    assert.equal(voce('HEAD /json/:id').byteCorpoRisposta, 0);
    assert.equal(voce('GET /stream').byteCorpoRisposta, Buffer.byteLength('città123'));
    assert.equal(voce('GET /assets/logo-solava-rid.png').byteCorpoRisposta, byteFile);
    assert.equal(voce('GET /invariata').nonModificate, 1);
    assert.equal(voce('GET /invariata').byteCorpoRisposta, 0);
    assert.equal(voce('GET /errore').errori, 1);
    assert.ok(dati.percorsi.every(v => v.durataMaxMs >= v.durataMediaMs));
    assert.doesNotMatch(JSON.stringify(dati), /segreto|\/json\/123|\/json\/456/);
});

test('diagnostica: chiusure anticipate e numero di percorsi limitato in memoria', () => {
    const diagnostica = creaDiagnosticaRete();
    for (let i = 0; i < 150; i++) {
        const res = new EventEmitter();
        Object.assign(res, { statusCode: 200, writableFinished: false, write() {}, end() {} });
        diagnostica.middleware({ method: 'GET', path: `/ignoto-${i}` }, res, () => {});
        res.write('test');
        res.emit('close');
        res.emit('finish');
    }
    const dati = diagnostica.statistiche();
    assert.equal(dati.inCorso, 0);
    assert.equal(dati.percorsi.length, 101);
    assert.equal(dati.percorsi.reduce((n, r) => n + r.interrotte, 0), 150);
    assert.equal(dati.percorsi.reduce((n, r) => n + r.byteCorpoRisposta, 0), 600);
});

test('diagnostica richiede la sessione quando il controllo accesso e attivo', async t => {
    const creaAccesso = require('../middleware/accesso');
    const diagnostica = creaDiagnosticaRete();
    const app = express();
    app.use(diagnostica.middleware);
    app.use(creaAccesso({ leggiConfig: async () => ({ richiediAuth: true }), leggiSessione: req => req.headers.cookie === 'valida' }));
    app.use(require('../routes/diagnosticaRete')(diagnostica));
    const base = await avvia(t, app);
    assert.equal((await fetch(base + '/api/diagnostica/rete')).status, 401);
    const autorizzata = await fetch(base + '/api/diagnostica/rete', { headers: { Cookie: 'valida' } });
    assert.equal(autorizzata.status, 200);
    assert.equal(autorizzata.headers.get('cache-control'), 'no-store');
    assert.equal((await autorizzata.json()).richiesteAvviate, 0);
    const pagina = await fetch(base + '/paginaRichieste.html', { redirect: 'manual' });
    assert.equal(pagina.status, 302);
    assert.match(pagina.headers.get('location'), /^\/autenticazione.html\?ritorno=%2FpaginaRichieste.html$/);
});

test('query reparto conserva i filtri evitando la conversione della colonna data', async () => {
    let testo;
    const request = { input(nome, tipo, valore) { assert.equal(valore, '03'); return this; }, async query(sql) { testo = sql; return { recordset: [] }; } };
    const context = { module: { exports: {} }, process: { env: { DB_NOME_PLC: 'PLC_TEST' } }, require(nome) {
        if (nome === './pool') return { getPool: async () => ({ request: () => request }), sql: { VarChar: () => 'varchar' } };
        if (nome === '../config/reparti') return { getReparto };
        return {};
    } };
    vm.runInNewContext(sorgente('db/queries.js'), context);
    await context.module.exports.eseguiQueryReparto('cava');
    assert.match(testo, /WHERE DATA_AVANZ_GIORNALIERO >= CAST\(DATEADD\(DAY, -1, GETDATE\(\)\) AS DATE\)/);
    assert.match(testo, /RAGGR_CODICE_REPARTO = @codiceReparto/);
    assert.match(testo, /STATO_BOLLA_OPERATORE IN \(0, 1, 2, 3, 4\)/);
});

test('log circolare: conserva 500 righe, invia solo le nuove e recupera cursori scaduti o di un altro avvio', () => {
    const diagnostica = creaDiagnosticaRete();
    for (let i = 0; i < 600; i++) {
        const res = new EventEmitter();
        Object.assign(res, { statusCode: 200, writableFinished: true, write() {}, end() {} });
        diagnostica.middleware({ method: 'GET', path: '/api/stato', route: { path: '/api/stato' },
            query: { reparto: 'cava', password: 'segreto' }, socket: { remoteAddress: '::ffff:10.50.0.154' } }, res, () => {});
        res.end('test');
        res.emit('finish');
        res.emit('close');
    }
    const tutto = diagnostica.statistiche();
    assert.equal(tutto.richiesteRecenti.length, 500);
    assert.equal(tutto.richiesteRecenti[0].id, 600);
    assert.equal(tutto.richiesteRecenti.at(-1).id, 101);
    assert.equal(tutto.richiesteRecenti[0].ip, '10.50.0.154');
    assert.equal(tutto.richiesteRecenti[0].reparto, 'cava');
    assert.equal(tutto.richiesteRecenti[0].byteCorpoRisposta, 4);
    assert.equal(tutto.logCompleto, true);
    assert.doesNotMatch(JSON.stringify(tutto), /password|segreto/);
    const delta = diagnostica.statistiche({ dopo: 590 });
    assert.equal(delta.logCompleto, false);
    assert.equal(delta.richiesteRecenti.length, 10);
    assert.equal(delta.richiesteRecenti.at(-1).id, 591);
    assert.equal(diagnostica.statistiche({ dopo: 600 }).richiesteRecenti.length, 0);
    assert.equal(diagnostica.statistiche({ dopo: 600, avvioRichiesto: tutto.avvio }).logCompleto, false);
    assert.equal(diagnostica.statistiche({ dopo: 600, avvioRichiesto: '2020-01-01T00:00:00Z' }).richiesteRecenti.length, 500);
    assert.equal(diagnostica.statistiche({ dopo: 100 }).logCompleto, false);
    for (const dopo of [0, 99, 999]) {
        assert.equal(diagnostica.statistiche({ dopo }).logCompleto, true);
        assert.equal(diagnostica.statistiche({ dopo }).richiesteRecenti.length, 500);
    }
    tutto.richiesteRecenti[0].ip = 'modificato';
    assert.equal(diagnostica.statistiche().richiesteRecenti[0].ip, '10.50.0.154');
});

test('API log: pagina e asset disponibili, cursore validato e diagnostica esclusa dal proprio log', async t => {
    const diagnostica = creaDiagnosticaRete();
    const app = express();
    app.use(diagnostica.middleware);
    app.use(require('../routes/diagnosticaRete')(diagnostica));
    app.use(express.static(path.join(__dirname, '../public')));
    const base = await avvia(t, app);
    const pagina = await fetch(base + '/paginaRichieste.html');
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /id="richieste-log"/);
    for (const risorsa of ['/js/richieste.js', '/css/richieste.css']) {
        const res = await fetch(base + risorsa);
        assert.equal(res.status, 200);
        await res.text();
    }
    const prima = await fetch(base + '/api/diagnostica/rete');
    assert.equal(prima.headers.get('cache-control'), 'no-store');
    const dati = await prima.json();
    assert.equal(dati.richiesteRecenti.length, 3);
    assert.equal(dati.monitorReparti.lettureSql, 0);
    const seconda = await (await fetch(base + '/api/diagnostica/rete?dopo=' + dati.ultimoId)).json();
    assert.equal(seconda.richiesteAvviate, 3);
    assert.equal(seconda.richiesteRecenti.length, 0);
    assert.equal(seconda.logCompleto, false);
    const nuovoAvvio = await (await fetch(base + '/api/diagnostica/rete?dopo=3&avvio=2020-01-01T00%3A00%3A00Z')).json();
    assert.equal(nuovoAvvio.logCompleto, true);
    assert.equal(nuovoAvvio.richiesteRecenti.length, 3);
    for (const query of ['dopo=-1', 'dopo=x', 'dopo=1.5', 'dopo=9007199254740992', 'dopo=1&dopo=2', 'dopo=', 'avvio=x', 'avvio=2026&avvio=2025']) {
        assert.equal((await fetch(base + '/api/diagnostica/rete?' + query)).status, 400, query);
    }
});

test('trend al minuto: conteggi, byte, tempi ed errori, intervalli parziali e minuti senza traffico', () => {
    let ora = Date.parse('2026-10-27T08:00:30Z');
    let nano = 0n;
    const diagnostica = creaDiagnosticaRete({ orologio: () => ora, cronometro: () => nano });
    function richiesta(stato, corpo, durata) {
        const res = new EventEmitter();
        Object.assign(res, { statusCode: stato, writableFinished: true, write() {}, end() {} });
        diagnostica.middleware({ method: 'GET', path: '/test' }, res, () => {});
        ora += durata;
        nano += BigInt(durata) * 1000000n;
        res.end(corpo);
        res.emit('finish');
        res.emit('close');
    }
    richiesta(200, 'abc', 100);
    richiesta(503, 'é', 300);
    richiesta(304, '', 600);
    let trend = diagnostica.statistiche().trend;
    assert.equal(trend.intervalloMs, 60000);
    assert.equal(trend.campioni.length, 1);
    assert.equal(trend.campioni[0].richieste, 3);
    assert.equal(trend.campioni[0].byteCorpoRisposta, 5);
    assert.equal(trend.campioni[0].durataMediaMs, 333.33);
    assert.equal(trend.campioni[0].durataMaxMs, 600);
    assert.equal(trend.campioni[0].errori, 1);
    assert.equal(trend.campioni[0].parziale, true);
    ora = Date.parse('2026-10-27T08:01:10Z');
    richiesta(200, 'ok', 5);
    ora = Date.parse('2026-10-27T08:03:00Z');
    trend = diagnostica.statistiche().trend;
    assert.equal(trend.campioni.length, 4);
    assert.equal(trend.campioni[1].parziale, false);
    assert.equal(trend.campioni[1].richieste, 1);
    assert.equal(trend.campioni[1].durataMediaMs, 5);
    assert.equal(trend.campioni[2].richieste, 0);
    assert.equal(trend.campioni[2].byteCorpoRisposta, 0);
    assert.equal(trend.campioni[2].parziale, false);
    assert.equal(trend.campioni[3].parziale, true);
    ora = Date.parse('2026-10-27T08:03:59.900Z');
    richiesta(200, 'abc', 200);
    trend = diagnostica.statistiche().trend;
    assert.equal(trend.campioni[3].richieste, 0);
    assert.equal(trend.campioni[4].richieste, 1);
    assert.equal(trend.campioni[4].durataMaxMs, 200);
});

test('trend indipendente dai 500 log: conserva al massimo 30 minuti e riparte vuoto dopo riavvio', () => {
    let ora = Date.parse('2026-10-27T08:00:30Z');
    const diagnostica = creaDiagnosticaRete({ orologio: () => ora, cronometro: () => 0n });
    for (let i = 0; i < 600; i++) {
        const res = new EventEmitter();
        Object.assign(res, { statusCode: 200, writableFinished: true, write() {}, end() {} });
        diagnostica.middleware({ method: 'GET', path: '/test' }, res, () => {});
        res.end('a');
        res.emit('finish');
    }
    const prima = diagnostica.statistiche();
    assert.equal(prima.richiesteRecenti.length, 500);
    assert.equal(prima.trend.campioni[0].richieste, 600);
    assert.equal(prima.trend.campioni[0].byteCorpoRisposta, 600);
    ora = Date.parse('2026-10-27T08:35:30Z');
    const dopo = diagnostica.statistiche();
    assert.equal(dopo.trend.campioni.length, 30);
    assert.equal(dopo.trend.campioni[0].inizio, '2026-10-27T08:06:00.000Z');
    assert.equal(dopo.trend.campioni.at(-1).inizio, '2026-10-27T08:35:00.000Z');
    assert.ok(dopo.trend.campioni.every(c => c.richieste === 0));
    assert.equal(dopo.richiesteAvviate, 600);
    const riavviata = creaDiagnosticaRete({ orologio: () => ora });
    assert.equal(riavviata.statistiche().trend.campioni.length, 1);
    assert.equal(riavviata.statistiche().trend.campioni[0].richieste, 0);
});

test('peso della diagnostica: gli aggiornamenti non ritrasmettono i 500 log gia caricati', async t => {
    const inizio = Date.parse('2026-10-27T08:00:00Z');
    let ora = inizio;
    const diagnostica = creaDiagnosticaRete({ orologio: () => ora, cronometro: () => 0n });
    for (let indice = 0; indice < 600; indice++) {
        ora = inizio + Math.floor(indice / 20) * 60000;
        const res = new EventEmitter();
        Object.assign(res, { statusCode: 200, writableFinished: true, write() {}, end() {} });
        diagnostica.middleware({ method: 'GET', path: '/api/stato', route: { path: '/api/stato' },
            query: { reparto: 'cava' }, socket: { remoteAddress: '10.50.0.' + (indice % 20 + 1) } }, res, () => {});
        res.end('{"ok":true}');
        res.emit('finish');
    }
    const app = express();
    app.use(diagnostica.middleware);
    app.use(require('../routes/diagnosticaRete')(diagnostica));
    const base = await avvia(t, app);
    const completa = await (await fetch(base + '/api/diagnostica/rete')).text();
    const dati = JSON.parse(completa);
    const incrementale = await (await fetch(base + '/api/diagnostica/rete?dopo=' + dati.ultimoId
        + '&avvio=' + encodeURIComponent(dati.avvio))).text();
    const byteCompleti = Buffer.byteLength(completa);
    const byteIncrementali = Buffer.byteLength(incrementale);
    assert.equal(dati.richiesteRecenti.length, 500);
    assert.equal(dati.trend.campioni.length, 30);
    assert.equal(JSON.parse(incrementale).richiesteRecenti.length, 0);
    assert.ok(byteIncrementali < byteCompleti / 10);
    t.diagnostic('Simulazione locale: ' + byteCompleti + ' byte al primo caricamento, '
        + byteIncrementali + ' byte senza nuovi log.');
});
