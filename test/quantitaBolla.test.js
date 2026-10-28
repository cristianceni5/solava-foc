const test = require('node:test');
const assert = require('node:assert/strict');
const { configurazione, calcola } = require('../public/js/appoggioCalcoliBolla');

test('converte la richiesta in pezzi interi e restituisce la quantità gestionale', () => {
    const config = configurazione({ UM1: 'M', UM2: 'PZ', FATTPESO: 99, FATTORE_CONVERSIONE: '0,3' });
    const risultato = calcola('10', config);
    assert.equal(risultato.pezzi, 34);
    assert.equal(risultato.quantitaGestionale.toFixed(2), '10.20');
    assert.equal(config.unitaPerPezzo, 0.3);
    assert.equal(configurazione({ UM1: 'M', UM2: 'PZ', FATTPESO: 3.32 }), null);
});

test('riconosce i pezzi in UM1 e usa il fattore nel verso inverso', () => {
    const config = configurazione({ UM1: ' PZ ', UM2: 'MQ', FATTORE_CONVERSIONE: 1 / 0.3 });
    const risultato = calcola('10,0', config);
    assert.equal(config.unita, 'MQ');
    assert.equal(risultato.pezzi, 34);
    assert.ok(Math.abs(risultato.quantitaGestionale - 10.2) < 1e-12);
});

test('mantiene i pezzi già interi anche in presenza di errori floating point', () => {
    const config = configurazione({ UM1: 'M', UM2: 'PZ', FATTORE_CONVERSIONE: 0.01 });
    assert.equal(calcola('0,07', config).pezzi, 7);
    assert.equal(calcola('0', config).pezzi, 0);
    assert.equal(calcola('0,070001', config).pezzi, 8);
});

test('blocca fattori non validi, UM incompatibili e quantità non valide', () => {
    for (const fattore of [null, '', 0, -1, 'abc', Infinity]) {
        assert.equal(configurazione({ UM1: 'M', UM2: 'PZ', FATTORE_CONVERSIONE: fattore }), null);
    }
    assert.equal(configurazione({ UM1: 'M', UM2: 'MQ', FATTORE_CONVERSIONE: 2 }), null);
    const config = configurazione({ UM1: 'M', UM2: 'PZ', FATTORE_CONVERSIONE: 0.3 });
    for (const quantita of ['', ' ', '-1', 'abc', 'Infinity', '1e100']) {
        assert.equal(calcola(quantita, config), null);
    }
    const esempio = calcola('10', config);
    assert.equal(esempio.pezzi, 34);
    assert.equal(esempio.quantitaGestionale.toFixed(2), '10.20');
});
