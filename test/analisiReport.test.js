const test = require('node:test');
const assert = require('node:assert/strict');
const analisi = require('../public/js/analisiReport');

test('analisi giornaliera PC raggruppa pagine e reparti senza trasformare segnali in visite', () => {
    const dati = [{ secondiOsservati: 120, rilevazioni: 5, usi: [{ pagina: '/paginaReparto.html', reparto: 'cava', nomeReparto: 'Cava', rilevazioni: 5 }] }];
    const campi = analisi.riepilogoPc(dati);
    assert.equal(campi[0].valore, 1);
    assert.equal(campi[1].valore, '0 h 2 min');
    assert.equal(campi[2].valore, 5);
    assert.match(campi[3].valore, /Monitor reparto · Cava/);
    assert.equal(analisi.riepilogoPc([])[0].valore, 0);
});

test('analisi salvataggi: confronti ricette, zero, dati mancanti e limite temporale esplicito', () => {
    const frasi = analisi.salvataggi([
        { DATA_ORA: '2026-10-23T08:00:00', RICETTA_OMR: 1, RICETTA_MES: 1, TONN_TERRA: 0, HZ_CASSONE_1: 0 },
        { DATA_ORA: '2026-10-23T09:00:00', RICETTA_OMR: 1, RICETTA_MES: 2, TONN_TERRA: 10, HZ_CASSONE_1: 20 },
        { DATA_ORA: null, RICETTA_OMR: '', RICETTA_MES: null, TONN_TERRA: null }
    ]).join(' ');
    assert.match(frasi, /1 con ricette coincidenti, 2 con ricette diverse o incomplete/);
    assert.match(frasi, /dalle 08:00:00 alle 09:00:00/);
    assert.match(frasi, /letture da 0 a 10 t/);
    assert.match(frasi, /1 registrazioni non hanno un orario riconoscibile/);
    assert.match(frasi, /massimo 500/);
});
