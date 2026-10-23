const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function elemento() {
    return {
        children: [], textContent: '', value: '', eventi: {}, classList: { add() {} },
        setAttribute() {},
        append(...figli) { this.children.push(...figli); },
        replaceChildren(...figli) { this.children = figli; },
        addEventListener(nome, funzione) { this.eventi[nome] = funzione; }
    };
}
function ambiente() {
    const contesto = vm.createContext({ document: { createElement: elemento } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/reportTabella.js'), 'utf8'), contesto);
    return contesto;
}

test('report universale: colonne dinamiche, zeri, selezione persistente e dati vuoti', () => {
    const contenitore = elemento();
    const contesto = ambiente();
    const report = contesto.creaReportTabella({ contenitore, chiave: record => record.id });
    const [testata, vuoto, griglia] = contenitore.children;
    const selettore = testata.children[1].children[1];
    assert.equal(vuoto.hidden, false);
    assert.equal(selettore.disabled, true);
    const dati = [{ id: 1, pezzi: 0, attivo: false, note: '<script>test</script>' }, { id: 2, pezzi: 15, nuovoCampo: 'presente' }];
    report.aggiorna(dati);
    assert.equal(vuoto.hidden, true);
    assert.equal(griglia.children[0].children[1].textContent, '2');
    selettore.value = 'record:1';
    selettore.eventi.change();
    const valori = () => Object.fromEntries(griglia.children.map(campo => campo.children.map(elemento => elemento.textContent)));
    assert.equal(valori().pezzi, '0');
    assert.equal(valori().attivo, 'false');
    assert.equal(valori().note, '<script>test</script>');
    assert.equal(valori().nuovoCampo, '—');
    report.aggiorna([{ ...dati[1] }, { ...dati[0], pezzi: 7 }]);
    assert.equal(selettore.value, 'record:1');
    assert.equal(valori().pezzi, '7');
    report.aggiorna([dati[1]]);
    assert.equal(selettore.value, '');
    assert.equal(griglia.children[0].children[1].textContent, '1');
    report.aggiorna([]);
    assert.equal(vuoto.hidden, false);
    assert.equal(griglia.hidden, true);
});

test('report configurato: colonne formattate e riepiloghi indipendenti dal tipo di tabella', () => {
    const contenitore = elemento();
    const contesto = ambiente();
    const report = contesto.creaReportTabella({
        contenitore, titolo: 'Produzione', chiave: record => record.codice,
        etichetta: record => record.codice,
        colonne: [{ chiave: 'quantita', etichetta: 'Pezzi', formatta: valore => `${valore} PZ` }],
        riepilogo: records => [{ etichetta: 'Totale pezzi', valore: records.reduce((totale, record) => totale + record.quantita, 0) }]
    });
    report.aggiorna([{ codice: 'A', quantita: 12 }, { codice: 'B', quantita: 3 }]);
    const [testata, , griglia] = contenitore.children;
    assert.equal(testata.children[0].textContent, 'Produzione');
    assert.equal(griglia.children[0].children[1].textContent, '15');
    const selettore = testata.children[1].children[1];
    selettore.value = 'record:B';
    selettore.eventi.change();
    assert.equal(testata.children[0].textContent, 'B');
    assert.equal(griglia.children[0].children[0].textContent, 'Pezzi');
    assert.equal(griglia.children[0].children[1].textContent, '3 PZ');
});

test('report dashboard: indicatori distinti e distribuzione con quote accessibili', () => {
    const contenitore = elemento();
    const contesto = ambiente();
    const report = contesto.creaReportTabella({
        contenitore, layout: 'dashboard',
        riepilogo: () => [
            { etichetta: 'PC', valore: 2, tipo: 'metrica', descrizione: 'IP distinti.' },
            { etichetta: 'Distribuzione', voci: [{ etichetta: 'Monitor', valore: 3 }, { etichetta: 'Pannello', valore: 1 }] }
        ]
    });
    report.aggiorna([{ id: 1 }]);
    const griglia = contenitore.children[2];
    assert.match(griglia.children[0].className, /--metrica/);
    assert.match(griglia.children[1].className, /--distribuzione/);
    const righe = griglia.children[1].children[1].children[0].children;
    assert.equal(righe[0].children[1].textContent, '3 rilevazioni · 75%');
    assert.equal(righe[0].children[2].value, 3);
    assert.equal(righe[0].children[2].max, 4);
});
