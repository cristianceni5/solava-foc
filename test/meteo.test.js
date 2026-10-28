const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function avvia(t, fornitore) {
  const fetchOriginale = global.fetch;
  t.mock.method(global, 'fetch', fornitore);
  delete require.cache[require.resolve('../routes/meteo')];
  const app = express();
  app.use(require('../routes/meteo'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return () => fetchOriginale(`http://127.0.0.1:${server.address().port}/api/meteo`);
}

function previsione(istante, temperatura = 18.4, simbolo = 'clearsky_day') {
  return {
    time: new Date(istante).toISOString(),
    data: {
      instant: { details: { air_temperature: temperatura } },
      next_1_hours: { summary: { symbol_code: simbolo } }
    }
  };
}

test('meteo: condivide la richiesta e la cache tra PC e sceglie il dato più vicino a ora', async t => {
  let chiamate = 0;
  const ora = Date.now();
  const richiedi = await avvia(t, async (url, opzioni) => {
    chiamate++;
    assert.match(url, /lat=43.6262&lon=11.4844/);
    assert.match(opzioni.headers['User-Agent'], /solava.it/);
    await new Promise(resolve => setTimeout(resolve, 30));
    return new Response(JSON.stringify({ properties: { timeseries: [
      previsione(ora - 3600000, 12), previsione(ora, 18.4), previsione(ora + 3600000, 22)
    ] } }), { headers: { expires: new Date(ora + 3600000).toUTCString() } });
  });
  const risposte = await Promise.all([richiedi(), richiedi()]);
  for (const risposta of risposte) {
    assert.equal(risposta.status, 200);
    const dati = await risposta.json();
    assert.equal(dati.localita, 'Matassino');
    assert.equal(dati.temperatura, 18.4);
    assert.equal(dati.simbolo, 'clearsky_day');
  }
  assert.equal((await richiedi()).status, 200);
  assert.equal(chiamate, 1);
});

test('meteo: rifiuta dati vecchi e non presenta null come zero gradi', async t => {
  for (const voce of [previsione(Date.now() - 7200000), previsione(Date.now(), null)]) {
    await t.test(String(voce.data.instant.details.air_temperature), async st => {
      const richiedi = await avvia(st, async () => new Response(JSON.stringify({
        properties: { timeseries: [voce] }
      })));
      assert.equal((await richiedi()).status, 503);
    });
  }
});

test('meteo: gestisce il fornitore offline e limita i tentativi successivi', async t => {
  let chiamate = 0;
  const richiedi = await avvia(t, async () => {
    chiamate++;
    throw new Error('Offline');
  });
  assert.equal((await richiedi()).status, 503);
  assert.equal((await richiedi()).status, 503);
  assert.equal(chiamate, 1);
});

test('meteo UI: visualizza temperatura zero, icone giorno/notte e stato offline', async () => {
  const elementi = {
    'meteo-home': { removeAttribute(nome) { delete this[nome]; } },
    'meteo-testo': {}, 'meteo-icona': {}
  };
  const contesto = vm.createContext({
    document: { getElementById: id => elementi[id] },
    AbortSignal, Intl, Date,
    fetch: async () => ({ ok: true, json: async () => ({
      temperatura: 0, simbolo: 'clearsky_night', localita: 'Matassino', orario: new Date().toISOString()
    }) })
  });
  const codice = fs.readFileSync(path.join(__dirname, '../public/js/indice.js'), 'utf8');
  vm.runInContext(codice.slice(codice.indexOf('function descriviMeteo('), codice.indexOf('async function caricaIndice(')), contesto);
  await vm.runInContext('caricaMeteo()', contesto);
  assert.match(elementi['meteo-testo'].textContent, /^0 °C · Sereno · Matassino$/);
  assert.equal(elementi['meteo-icona'].className, 'fa-solid fa-moon');
  for (const [simbolo, icona] of [
    ['clearsky_day', 'fa-sun'], ['partlycloudy_day', 'fa-cloud-sun'],
    ['partlycloudy_night', 'fa-cloud-moon'], ['cloudy', 'fa-cloud'],
    ['rain', 'fa-cloud-showers-heavy'], ['snow', 'fa-snowflake'],
    ['fog', 'fa-smog'], ['heavyrainandthunder', 'fa-cloud-bolt']
  ]) {
    assert.equal(vm.runInContext(`descriviMeteo('${simbolo}')[0]`, contesto), icona);
  }
  contesto.fetch = async () => { throw new Error('Offline'); };
  await vm.runInContext('caricaMeteo()', contesto);
  assert.equal(elementi['meteo-testo'].textContent, 'Meteo non disponibile');
  assert.equal(elementi['meteo-home'].title, undefined);
});
