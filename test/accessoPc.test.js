const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const creaAccesso = require('../middleware/accesso');
const { creaRegistro } = require('../services/pcConnessi');

test('richiesta auth protegge pagine e API mantenendo pubblico il reparto', async () => {
  let richiediAuth = true;
  const app = express();
  app.use(creaAccesso({ leggiConfig: async () => ({ richiediAuth }), leggiSessione: req => req.headers.cookie === 'valida' }));
  app.use((req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const pagina of ['/', '/index.html', '/paginaPcConnessi.html', '/%69ndex.html', '/INDEX.HTML', '/index.html.']) {
      const res = await fetch(base + pagina, { redirect: 'manual' });
      assert.equal(res.status, 302, pagina);
      assert.match(res.headers.get('location'), /^\/autenticazione.html\?ritorno=/);
    }
    for (const percorso of ['/api/set-automazione', '/api/impostazioni', '/api/pc-connessi', '/api/etichette/stampa/test']) {
      assert.equal((await fetch(base + percorso, { method: 'POST' })).status, 401, percorso);
    }
    for (const percorso of ['/paginaReparto.html?reparto=1', '/api/stato', '/api/reparti', '/api/automazione', '/autenticazione.html', '/api/presenza', '/css/styles.css']) {
      assert.equal((await fetch(base + percorso)).status, 200, percorso);
    }
    assert.equal((await fetch(base + '/index.html', { headers: { Cookie: 'valida' } })).status, 200);
    richiediAuth = false;
    assert.equal((await fetch(base + '/index.html')).status, 200);
    assert.equal((await fetch(base + '/api/pc-connessi')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('registro PC persiste e accorpa gli IP anche con segnali concorrenti', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fop-pc-'));
  const file = path.join(directory, 'pc.json');
  try {
    const registro = creaRegistro(file);
    await Promise.all([
      registro.registra('192.168.1.10', '/index.html'),
      registro.registra('192.168.1.11', '/paginaReparto.html'),
      registro.registra('192.168.1.10', '/paginaPcConnessi.html')
    ]);
    const elenco = await registro.elenco();
    assert.equal(elenco.length, 2);
    assert.ok(elenco.every(pc => pc.connesso));
    assert.equal(elenco.find(pc => pc.ip === '192.168.1.10').pagina, '/paginaPcConnessi.html');
    await registro.registra('192.168.1.10', '/paginaReparto.html', 'cava');
    const conReparto = (await registro.elenco()).find(pc => pc.ip === '192.168.1.10');
    assert.equal(conReparto.reparto, 'cava');
    assert.equal(conReparto.nomeReparto, 'Prelavorazione - Cava');
    await registro.registra('192.168.1.10', '/index.html');
    assert.equal((await registro.elenco()).find(pc => pc.ip === '192.168.1.10').nomeReparto, '');
    const salvati = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(salvati.length, 2);
    salvati[0].ultimoContatto = '2020-01-01T00:00:00.000Z';
    await fs.writeFile(file, JSON.stringify(salvati));
    const riavviato = await creaRegistro(file).elenco();
    assert.equal(riavviato.find(pc => pc.ip === salvati[0].ip).connesso, false);
  } finally {
    await fs.unlink(file).catch(() => {});
    await fs.rmdir(directory);
  }
});

test('registro PC: file malformato conservato e scritture ripristinate dopo correzione', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fop-pc-'));
  const file = path.join(directory, 'pc.json');
  const registro = creaRegistro(file);
  try {
    for (const contenuto of ['[null]', '[{"ip":"1"}]', '{}', '{incompleto']) {
      await fs.writeFile(file, contenuto);
      await assert.rejects(registro.elenco());
      await assert.rejects(registro.registra('192.168.1.10', '/index.html'));
      assert.equal(await fs.readFile(file, 'utf8'), contenuto);
    }
    await fs.writeFile(file, '[]');
    await registro.registra('192.168.1.10', '/index.html');
    assert.equal((await registro.elenco()).length, 1);
  } finally {
    await fs.unlink(file).catch(() => {});
    await fs.rmdir(directory);
  }
});

test('storico PC separa le giornate e non conta le interruzioni come uso', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fop-giorni-'));
  const file = path.join(directory, 'pc.json');
  let ora = new Date('2026-10-23T08:00:00Z');
  const registro = creaRegistro(file, () => ora);
  try {
    assert.equal((await registro.report()).giorni.length, 0);
    await registro.registra('192.168.1.10', '/index.html');
    ora = new Date('2026-10-23T08:00:30Z');
    await registro.registra('192.168.1.10', '/paginaReparto.html', 'cava');
    ora = new Date('2026-10-23T08:10:00Z');
    await registro.registra('192.168.1.10', '/paginaReparto.html', 'cava');
    const report = await registro.report('2026-10-23');
    assert.equal(report.dati[0].rilevazioni, 3);
    assert.equal(report.dati[0].secondiOsservati, 30);
    assert.equal(report.dati[0].usi.length, 2);
    assert.equal(report.dati[0].usi[1].nomeReparto, 'Prelavorazione - Cava');
    ora = new Date('2026-10-24T08:00:00Z');
    await registro.registra('192.168.1.10', '/index.html');
    const domani = await registro.report('2026-10-24');
    assert.equal(domani.dati[0].rilevazioni, 1);
    assert.equal(domani.dati[0].secondiOsservati, 0);
    assert.equal((await registro.report('2026-10-22')).dati.length, 0);
    assert.equal((await registro.report('2026-10-23')).dati[0].rilevazioni, 3);
  } finally { await fs.unlink(file).catch(() => {}); await fs.rmdir(directory); }
});
