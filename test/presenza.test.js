const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('presenza: salva il reparto del monitor, lo azzera sulle altre pagine e rifiuta input non validi', async () => {
    const handlers = {};
    const registrazioni = [];
    const router = { post: (url, fn) => { handlers[url] = fn; }, get: (url, fn) => { handlers[url] = fn; } };
    const context = {
        module: { exports: {} }, console,
        require: nome => nome === 'express' ? { Router: () => router } : {
            registra: async (...args) => registrazioni.push(args), elenco: async () => []
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/pcConnessi.js'), 'utf8'), context);
    const invia = async body => {
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; }, sendStatus(code) { this.statusCode = code; } };
        await handlers['/api/presenza']({ body, socket: { remoteAddress: '::ffff:192.168.1.10' } }, res);
        return res;
    };
    assert.equal((await invia({ pagina: '/paginaReparto.html', reparto: 'cava' })).statusCode, 204);
    assert.deepEqual(registrazioni[0], ['192.168.1.10', '/paginaReparto.html', 'cava']);
    assert.equal((await invia({ pagina: '/index.html', reparto: 'cava' })).statusCode, 204);
    assert.equal(registrazioni[1][2], '');
    assert.equal((await invia({ pagina: '/paginaReparto.html', reparto: { id: 'cava' } })).statusCode, 400);
    assert.equal((await invia({ pagina: '/paginaReparto.html?password=segreto', reparto: '' })).statusCode, 400);
    assert.equal(registrazioni.length, 2);
});
