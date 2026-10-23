const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Excel: conserva accenti e IP, esclude HTML eseguibile e scarica senza ricaricare', async () => {
    let contenuto;
    let clic = 0;
    let rimosso = 0;
    let revocato;
    let pulizia;
    const link = { click() { clic++; }, remove() { rimosso++; } };
    const contesto = vm.createContext({
        document: {
            getElementById: id => id === 'tabella-pc' ? { rows: [
                { cells: [{ textContent: 'Indirizzo IP' }, { textContent: 'Ultima pagina' }] },
                { cells: [{ textContent: '192.168.1.10' }, { textContent: 'Quantità <script> & "test"' }] }
            ] } : null,
            createElement: () => link,
            body: { appendChild() {} }
        },
        Blob, navigator: {},
        URL: { createObjectURL(blob) { contenuto = blob; return 'blob:test'; }, revokeObjectURL(url) { revocato = url; } },
        window: { setTimeout(fn) { pulizia = fn; }, location: { reload() { throw new Error('Ricaricamento indesiderato'); } } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/esportazioneExcel.js'), 'utf8'), contesto);
    vm.runInContext("clickButton('tabella-pc', 'computerConnessi')", contesto);
    assert.equal(link.download, 'computerConnessi.xls');
    assert.equal(link.href, 'blob:test');
    assert.equal(clic, 1);
    assert.equal(rimosso, 1);
    const html = await contenuto.text();
    assert.match(html, /192\.168\.1\.10/);
    assert.match(html, /Quantità &lt;script&gt; &amp; &quot;test&quot;/);
    assert.ok(!html.includes('<script>'));
    pulizia();
    assert.equal(revocato, 'blob:test');
    vm.runInContext("exportTableToExcel('inesistente')", contesto);
    assert.equal(clic, 1);
});
