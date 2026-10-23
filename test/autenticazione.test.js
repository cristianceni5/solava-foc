const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

test('accesso JSON: validazione, sessione e logout', async () => {
  const app = express();
  app.use(express.json());
  app.use(require('../routes/autenticazione'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/autenticazione`;
  const post = body => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ utente: [], password: 'test' })).status, 400);
    const utenti = JSON.parse((await fs.readFile(path.join(__dirname, '../config/utenti.json'), 'utf8')).replace(/^\uFEFF/, ''));
    const utente = utenti[0];
    assert.ok(utente, 'Configurare almeno un utente per il test di accesso');
    const negato = await post({ utente: utente.utente, password: utente.password + '-errata' });
    assert.equal(negato.status, 401);
    assert.equal(negato.headers.get('set-cookie'), null);
    const risposta = await post(utente);
    assert.equal(risposta.status, 200);
    assert.deepEqual(await risposta.json(), { utente: utente.utente });
    assert.equal(risposta.headers.get('cache-control'), 'no-store');
    const cookieCompleto = risposta.headers.get('set-cookie');
    assert.match(cookieCompleto, /HttpOnly/i);
    assert.match(cookieCompleto, /SameSite=Strict/i);
    const headers = { Cookie: cookieCompleto.split(';')[0] };
    const sessione = await fetch(url, { headers });
    assert.equal(sessione.status, 200);
    assert.deepEqual(await sessione.json(), { utente: utente.utente });
    assert.equal((await fetch(url, { headers: { Cookie: 'fop_sessione=inesistente' } })).status, 401);
    assert.equal((await fetch(url + '/logout', { method: 'POST', headers })).status, 204);
    assert.equal((await fetch(url, { headers })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
