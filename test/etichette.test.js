// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: verificare validazione, calcolo dei campi e compilazione dei template ZPL.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizzaDatiStampa, creaCampiEtichetta, compilaZplEtichetta } = require('../utils/formattaEtichetta');

const articolo = {
    codice: 'ART001',
    descrizione: 'Articolo prova',
    descrizioneAggiuntiva: null,
    pezziPerPacco: 120,
    pezziPerSec: 10,
    fattoreConv: 2.5,
    stampaLotto: true,
    stampaUnitaMisuraSecondaria: false,
    um1: 'PZ',
    um2: 'BLK',
    numeroMarcaturaCE: 'CE123',
    enteCertificatore: 'Ente',
    dop: 'DOP001',
    norma: 'Norma',
    categoria: 'Categoria',
    campiZpl: { CLASSIFICAZIONE: 'Classe' }
};
const input = { lotto: ' LOT001 ', pezziPacco: '120', pezziBLK: '10', quantitaEtichette: '3' };
const data = new Date(2026, 9, 10, 12, 34, 56);

test('normalizza parametri della query e del body, inclusi i toggle', () => {
    const dati = normalizzaDatiStampa(input);
    assert.deepEqual(dati, {
        lotto: 'LOT001', mostraCE: true, mostraICMQ: true, mostraStabilimento: true, invertiValoriUM: false,
        pezziPacco: 120, pezziBLK: 10, quantitaEtichette: 3
    });
    for (const valore of [false, 'false']) {
        const disattivati = normalizzaDatiStampa({ ...input, mostraCE: valore, mostraICMQ: valore });
        assert.equal(disattivati.mostraCE, false);
        assert.equal(disattivati.mostraICMQ, false);
    }
});

test('il testo stabilimento viene escluso dallo ZPL solo quando disattivato', () => {
    const template = fs.readFileSync(path.join(__dirname, '..', 'template_etichette', 'CAM_redesign_def_2.prn'), 'utf8');
    for (const valore of [undefined, true, 'true', false, 'false']) {
        const dati = normalizzaDatiStampa({ ...input, mostraStabilimento: valore });
        const campi = creaCampiEtichetta(articolo, dati, data);
        const zpl = compilaZplEtichetta(template, campi, dati);
        assert.equal(zpl.includes('Stabilimento di produzione'), valore !== false && valore !== 'false');
        assert.ok(zpl.includes('Via Urbinese'));
        assert.ok(zpl.includes('ART001'));
        assert.match(zpl, /\^PQ3,/);
    }
});

test('rifiuta lotti con comandi ZPL e quantità mancanti o fuori limite', () => {
    for (const modifica of [
        { lotto: '^XA' }, { lotto: '~JA' },
        { pezziPacco: '' }, { pezziPacco: -1 }, { pezziPacco: 1.5 },
        { pezziBLK: 0 }, { pezziBLK: 'abc' },
        { quantitaEtichette: undefined }, { quantitaEtichette: 0 }, { quantitaEtichette: 1000 }
    ]) {
        assert.throws(() => normalizzaDatiStampa({ ...input, ...modifica }), { status: 400 });
    }
    assert.equal(normalizzaDatiStampa({ ...input, pezziPacco: 0, quantitaEtichette: 999 }).pezziPacco, 0);
});

test('compila quantità, unità, QR e timestamp per articolo con una sola unità', () => {
    const campi = creaCampiEtichetta(articolo, normalizzaDatiStampa(input), data);
    assert.equal(campi.PEZZI_PACCO, 120);
    assert.equal(campi.MT_PACCO, '');
    assert.equal(campi.UM1, 'PZ/Pallet');
    assert.equal(campi.UM2, '');
    assert.equal(campi.QR, 'ART001;LOT001;120');
    assert.equal(campi.PROGRESSIVO, '101026123456');
    assert.equal(campi.CAMPO_1, 'Classe');
});

test('calcola la doppia unità e conserva la quantità modificata dall’operatore', () => {
    const doppia = { ...articolo, stampaUnitaMisuraSecondaria: true };
    const campi = creaCampiEtichetta(doppia, normalizzaDatiStampa(input), data);
    assert.equal(campi.PEZZI_PACCO, 12);
    assert.equal(campi.MT_PACCO, '30.00');
    assert.equal(campi.UM1, 'BLK/Pallet');
    assert.equal(campi.UM2, 'PZ/Pallet');
    const blkModificati = creaCampiEtichetta(doppia, normalizzaDatiStampa({ ...input, pezziBLK: 20 }), data);
    assert.equal(blkModificati.PEZZI_PACCO, 6);
    assert.equal(blkModificati.MT_PACCO, '15.00');
    assert.equal(blkModificati.QR, 'ART001;LOT001;6');
    const modificati = creaCampiEtichetta(doppia, normalizzaDatiStampa({ ...input, pezziPacco: 7 }), data);
    assert.equal(modificati.PEZZI_PACCO, 7);
    assert.equal(modificati.MT_PACCO, '17.50');
    const fallback = creaCampiEtichetta({ ...doppia, pezziPerSec: null }, normalizzaDatiStampa(input), data);
    assert.equal(fallback.PEZZI_PACCO, 12);
    const senzaConversione = creaCampiEtichetta({ ...doppia, fattoreConv: null }, normalizzaDatiStampa(input), data);
    assert.equal(senzaConversione.MT_PACCO, '');
});

test('A/6600 abbina i pezzi a PZ e la superficie convertita a MQ anche nello ZPL', () => {
    const dati = normalizzaDatiStampa({ ...input, pezziPacco: 405, pezziBLK: 1 });
    const campi = creaCampiEtichetta({
        ...articolo, codice: 'A/6600', pezziPerPacco: 405,
        um1: 'PZ', um2: 'MQ', fattoreConv: 0.045,
        stampaUnitaMisuraSecondaria: true
    }, dati, data);
    assert.equal(campi.PEZZI_PACCO, 405);
    assert.equal(campi.MT_PACCO, (405 * 0.045).toFixed(2));
    assert.equal(campi.UM1, 'PZ/Pallet');
    assert.equal(campi.UM2, 'MQ/Pallet');
    const zpl = compilaZplEtichetta(
        '^XA^FD{PEZZI_PACCO} {UM1}^FS^FD{MT_PACCO} {UM2}^FS^XZ', campi, dati
    );
    assert.ok(zpl.includes('405 PZ/Pallet'));
    assert.ok(zpl.includes(`${campi.MT_PACCO} MQ/Pallet`));
});

test('inverte solo i valori delle UM quando richiesto da query o body', () => {
    const doppia = { ...articolo, stampaUnitaMisuraSecondaria: true };
    for (const valore of [true, 'true', false, 'false', undefined]) {
        const dati = normalizzaDatiStampa({ ...input, invertiValoriUM: valore });
        const campi = creaCampiEtichetta(doppia, dati, data);
        const attivo = valore === true || valore === 'true';
        assert.equal(campi.PEZZI_PACCO, attivo ? '30.00' : 12);
        assert.equal(campi.MT_PACCO, attivo ? 12 : '30.00');
        assert.equal(campi.UM1, 'BLK/Pallet');
        assert.equal(campi.UM2, 'PZ/Pallet');
        assert.equal(campi.QR, 'ART001;LOT001;12');
    }
    const dati = normalizzaDatiStampa({ ...input, invertiValoriUM: true });
    const singola = creaCampiEtichetta(articolo, dati, data);
    assert.equal(singola.PEZZI_PACCO, 120);
    assert.equal(singola.MT_PACCO, '');
    const senzaConversione = creaCampiEtichetta({ ...doppia, fattoreConv: null }, dati, data);
    assert.equal(senzaConversione.PEZZI_PACCO, 12);
    assert.equal(senzaConversione.MT_PACCO, '');
});

test('UM2 mostra la conversione anche se non abilitata per la stampa', () => {
    const { calcolaQuantitaEtichetta } = require('../public/js/quantitaEtichetta');
    const dati = normalizzaDatiStampa({ ...input, pezziPacco: 405, pezziBLK: 1 });
    const a = { ...articolo, codice: 'A/6600', pezziPerPacco: 405,
        um1: 'PZ', um2: 'MQ', fattoreConv: 0.045, stampaUnitaMisuraSecondaria: false };
    const quantita = calcolaQuantitaEtichetta(a, dati);
    assert.equal(quantita.valore1, 405);
    assert.equal(quantita.secondariaCalcolata, '18.22');
    assert.equal(quantita.valore2, '');
    assert.equal(creaCampiEtichetta(a, dati, data).MT_PACCO, '');
});

test('il calcolo caricato dal browser coincide con i campi stampati', () => {
    const vm = require('node:vm');
    const contesto = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/quantitaEtichetta.js'), 'utf8'), contesto);
    const { creaRispostaArticolo } = require('../utils/normalizzaArticolo');
    for (const um2 of ['MQ', 'BLK']) {
        for (const invertiValoriUM of [false, true]) {
            const doppia = { ...articolo, um2, stampaUnitaMisuraSecondaria: true };
            const pubblico = creaRispostaArticolo(doppia).articolo;
            assert.equal(pubblico.fattoreConv, doppia.fattoreConv);
            const dati = normalizzaDatiStampa({ ...input, invertiValoriUM });
            const browser = contesto.calcolaQuantitaEtichetta(pubblico, dati);
            const stampa = creaCampiEtichetta(doppia, dati, data);
            assert.equal(browser.valore1, stampa.PEZZI_PACCO);
            assert.equal(browser.valore2, stampa.MT_PACCO);
            assert.equal(browser.unita1 + '/Pallet', stampa.UM1);
            assert.equal(browser.unita2 + '/Pallet', stampa.UM2);
        }
    }
});

test('valida lotto obbligatorio e usa i pezzi BLK inviati anche se il DB non e valido', () => {
    const senzaLotto = normalizzaDatiStampa({ ...input, lotto: '' });
    assert.throws(() => creaCampiEtichetta(articolo, senzaLotto), { status: 400 });
    assert.doesNotThrow(() => creaCampiEtichetta({ ...articolo, stampaLotto: false }, senzaLotto));
    for (const pezziPerSec of [0, -1, 'abc']) {
        const campi = creaCampiEtichetta({ ...articolo, stampaUnitaMisuraSecondaria: true, pezziPerSec }, normalizzaDatiStampa(input));
        assert.equal(campi.PEZZI_PACCO, 12);
    }
});

test('unifica i blocchi ZPL e compila i placeholder e il numero di copie', () => {
    const dati = normalizzaDatiStampa(input);
    const campi = creaCampiEtichetta(articolo, dati, data);
    const template = '^XA^FD{ARTICOLO}^FS^XZ\n^XA^FD{QR}|{DESCR_AGG}|{SCONOSCIUTO}^FS^PQ1,0,1,Y^XZ';
    assert.equal(compilaZplEtichetta(template, campi, dati), '^XA^FDART001^FS^FDART001;LOT001;120||^FS^PQ3,0,1,Y^XZ');
});

test('compila il template reale con entrambi i loghi attivi o disattivati', () => {
    const template = fs.readFileSync(path.join(__dirname, '..', 'template_etichette', 'CAM_redesign_def_2.prn'), 'utf8');
    for (const mostraCE of [true, false]) {
        for (const mostraICMQ of [true, false]) {
            const dati = normalizzaDatiStampa({ ...input, mostraCE, mostraICMQ });
            const campi = creaCampiEtichetta(articolo, dati, data);
            const zpl = compilaZplEtichetta(template, campi, dati);
            assert.equal(zpl.includes('^FO128,256^GFA'), mostraCE);
            assert.equal(zpl.includes('^FO800,256^GFA'), mostraICMQ);
            assert.equal(zpl.includes('^FT862,504'), mostraICMQ);
            assert.equal(zpl.includes('^FT862,538'), mostraICMQ);
            assert.equal(campi.MARCATURA, mostraCE ? 'CE123' : '');
            assert.equal(campi.DOP, mostraCE ? 'DOP001' : '');
            assert.match(zpl, /\^PQ3,/);
            assert.doesNotMatch(zpl, /\{[A-Z0-9_]+\}/);
        }
    }
});
