// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: verificare recupero SQL, salvataggi concorrenti, validazione e timeout anteprima.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');

async function caricaModulo(file, mocks = {}, globals = {}) {
  const codice = await fs.readFile(path.join(__dirname, '..', file), 'utf8');
  const contesto = {
    module: { exports: {} }, __dirname: path.join(__dirname, '..', path.dirname(file)),
    process: { env: {} }, Buffer, AbortSignal, console,
    require: nome => Object.hasOwn(mocks, nome) ? mocks[nome] : require(nome),
    ...globals
  };
  vm.runInNewContext(codice, contesto, { filename: file });
  return contesto.module.exports;
}

test('SQL riprova dopo un errore e condivide i tentativi concorrenti', async () => {
  let tentativi = 0;
  const connessione = { connected: true };
  const sql = { ConnectionPool: class {
    async connect() {
      tentativi++;
      if (tentativi === 1) throw new Error('SQL offline');
      return connessione;
    }
  } };
  const { getPool } = await caricaModulo('db/pool.js', { mssql: sql });
  const primo = getPool();
  assert.equal(getPool(), primo);
  await assert.rejects(primo, /SQL offline/);
  const secondo = getPool();
  assert.equal(getPool(), secondo);
  assert.equal(await secondo, connessione);
  assert.equal(await getPool(), connessione);
  assert.equal(tentativi, 2);
});

async function configurazioneTemporanea(t, overrideFs) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solava-test-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, 'config'));
  const file = path.join(root, 'config', 'settaggi.json');
  await fs.writeFile(file, JSON.stringify({ consensoAuto: false, minuti: 5, altro: 'conservato' }));
  const servizio = await caricaModulo('services/automazione.js', {
    fs: { promises: overrideFs || fs }
  }, { __dirname: path.join(root, 'services') });
  return { servizio, file, root };
}

test('aggiornamenti concorrenti conservano entrambi i campi e il JSON rimane leggibile', async t => {
  const { servizio, file, root } = await configurazioneTemporanea(t);
  await Promise.all([
    servizio.aggiornaConfig({ consensoAuto: true }),
    servizio.aggiornaConfig({ minuti: '10' }),
    servizio.leggiConfig()
  ]);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { consensoAuto: true, minuti: 10, altro: 'conservato' });
  assert.deepEqual(await fs.readdir(path.join(root, 'config')), ['settaggi.json']);
});

test('scrittura fallita conserva il file precedente e non blocca la coda', async t => {
  let prima = true;
  const fakeFs = { ...fs, async rename(...args) {
    if (prima) { prima = false; throw new Error('Rename fallito'); }
    return fs.rename(...args);
  } };
  const { servizio, file, root } = await configurazioneTemporanea(t, fakeFs);
  await assert.rejects(servizio.aggiornaConfig({ minuti: 10 }), /Rename fallito/);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).minuti, 5);
  assert.deepEqual(await fs.readdir(path.join(root, 'config')), ['settaggi.json']);
  await servizio.aggiornaConfig({ minuti: 15 });
  assert.equal((await servizio.leggiConfig()).minuti, 15);
});

test('valida minuti e consenso senza modificare il file per input non validi', async t => {
  const { servizio, file } = await configurazioneTemporanea(t);
  const precedente = await fs.readFile(file, 'utf8');
  for (const minuti of [-1, 1.5, '5abc', '2.5', '', ' ', null, true, [], {}, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(servizio.aggiornaConfig({ minuti }), err => err.status === 400);
  }
  for (const consensoAuto of ['abc', 0, 1, null, [], {}]) {
    await assert.rejects(servizio.aggiornaConfig({ consensoAuto }), err => err.status === 400);
  }
  for (const body of [undefined, null, 'abc', []]) {
    await assert.rejects(servizio.aggiornaConfig(body), err => err.status === 400);
  }
  assert.equal(await fs.readFile(file, 'utf8'), precedente);
  await servizio.aggiornaConfig({ consensoAuto: 'false', minuti: '0' });
  const config = await servizio.leggiConfig();
  assert.equal(config.consensoAuto, false);
  assert.equal(config.minuti, 0);
});

test('configurazione assente usa i valori iniziali', async t => {
  const { servizio, file } = await configurazioneTemporanea(t);
  await fs.unlink(file);
  const config = await servizio.leggiConfig();
  assert.equal(config.consensoAuto, false);
  assert.equal(config.minuti, 0);
  await servizio.aggiornaConfig({ minuti: 2 });
  assert.equal((await servizio.leggiConfig()).minuti, 2);
});

test('richiediAuth viene validato e salvato senza perdere le impostazioni esistenti', async t => {
  const { servizio, file } = await configurazioneTemporanea(t);
  const precedente = await fs.readFile(file, 'utf8');
  for (const richiediAuth of ['true', 'false', 0, 1, null, [], {}]) {
    await assert.rejects(servizio.aggiornaConfig({ richiediAuth }), err => err.status === 400);
  }
  assert.equal(await fs.readFile(file, 'utf8'), precedente);
  await Promise.all([
    servizio.aggiornaConfig({ richiediAuth: true }),
    servizio.aggiornaConfig({ minuti: 12 })
  ]);
  let config = await servizio.leggiConfig();
  assert.equal(config.richiediAuth, true);
  assert.equal(config.minuti, 12);
  assert.equal(config.altro, 'conservato');
  await servizio.aggiornaConfig({ richiediAuth: false });
  config = await servizio.leggiConfig();
  assert.equal(config.richiediAuth, false);
});

test('la route restituisce 400 per impostazioni errate e conserva il contratto GET', async () => {
  const handlers = {};
  const router = { get(url, fn) { handlers[url] = fn; }, post(url, fn) { handlers[url] = fn; } };
  await caricaModulo('routes/automazione.js', {
    express: { Router: () => router },
    '../services/automazione': {
      async leggiConfig() { return { consensoAuto: 'false', minuti: -5 }; },
      async aggiornaConfig() { const err = new Error('Minuti non validi'); err.status = 400; throw err; }
    }
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handlers['/api/set-automazione']({ body: { minuti: -5 } }, res);
  assert.equal(res.code, 400);
  assert.equal(res.body.errore, 'Minuti non validi');
  await handlers['/api/automazione']({}, res);
  assert.equal(res.code, 200);
  assert.equal(res.body[0].consenso, false);
  assert.equal(res.body[0].minuti, 0);
  assert.equal(res.body[0].finestra, 'Reparto - Factory Operation Panel');
});

async function anteprimaConFetch(fetch, controller = new AbortController()) {
  return caricaModulo('services/anteprimaEtichetta.js', {}, {
    fetch, AbortSignal: { timeout(ms) { assert.equal(ms, 10000); return controller.signal; } }
  });
}

test('anteprima invia lo ZPL e restituisce il buffer PNG', async () => {
  const servizio = await anteprimaConFetch(async (url, opzioni) => {
    assert.match(url, /api\.labelary\.com/);
    assert.equal(opzioni.body, '^XA^XZ');
    assert.equal(opzioni.method, 'POST');
    assert.ok(opzioni.signal instanceof AbortSignal);
    return { ok: true, async arrayBuffer() { return Uint8Array.from([1, 2, 3]).buffer; } };
  });
  assert.deepEqual(await servizio.generaAnteprimaEtichetta('^XA^XZ'), Buffer.from([1, 2, 3]));
});

test('anteprima distingue rifiuto ZPL, rete non disponibile e timeout', async () => {
  const rifiuto = await anteprimaConFetch(async () => ({ ok: false, async text() { return 'ZPL non valido'; } }));
  await assert.rejects(rifiuto.generaAnteprimaEtichetta('zpl'), err => err.status === 502 && err.dettaglio === 'ZPL non valido');
  const rete = await anteprimaConFetch(async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(rete.generaAnteprimaEtichetta('zpl'), err => err.status === 502 && /connessione Internet/.test(err.message));
  const controller = new AbortController();
  const timeout = await anteprimaConFetch(async () => {
    controller.abort(new DOMException('Timeout', 'TimeoutError'));
    throw controller.signal.reason;
  }, controller);
  await assert.rejects(timeout.generaAnteprimaEtichetta('zpl'), err => err.status === 504 && /10 secondi/.test(err.message));
});

test('il timeout copre anche un download PNG bloccato', async () => {
  const controller = new AbortController();
  const servizio = await anteprimaConFetch(async () => ({ ok: true, async arrayBuffer() {
    controller.abort(new DOMException('Timeout', 'TimeoutError'));
    throw controller.signal.reason;
  } }), controller);
  await assert.rejects(servizio.generaAnteprimaEtichetta('zpl'), err => err.status === 504);
});

test('settaggi Windows: accetta BOM, conserva file non validi e recupera dopo la correzione', async t => {
  const { servizio, file } = await configurazioneTemporanea(t);
  await fs.writeFile(file, '\uFEFF' + JSON.stringify({ minuti: 5, consensoAuto: true }));
  assert.equal((await servizio.leggiConfig()).minuti, 5);
  await servizio.aggiornaConfig({ minuti: 6 });
  assert.equal((await servizio.leggiConfig()).minuti, 6);
  for (const contenuto of ['null', '[]', '"test"', '{non valido']) {
    await fs.writeFile(file, contenuto);
    await assert.rejects(servizio.leggiConfig());
    await assert.rejects(servizio.aggiornaConfig({ minuti: 7 }));
    assert.equal(await fs.readFile(file, 'utf8'), contenuto);
  }
  await fs.writeFile(file, '{"minuti":8}');
  await servizio.aggiornaConfig({ minuti: 9 });
  assert.equal((await servizio.leggiConfig()).minuti, 9);
});
