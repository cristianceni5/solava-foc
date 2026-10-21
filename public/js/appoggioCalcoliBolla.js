// Conversione quantità bolla tramite FATTPESO: UM2 = UM1 * FATTPESO.
(function (root) {
    function numero(valore) {
        if (valore === null || valore === undefined || String(valore).trim() === '') return NaN;
        return Number(String(valore).trim().replace(',', '.'));
    }
    function configurazione(articolo) {
        const um1 = String(articolo.UM1 || '').trim().toUpperCase();
        const um2 = String(articolo.UM2 || '').trim().toUpperCase();
        const fattore = numero(articolo.FATTPESO);
        const pezzi = um => ['PZ', 'PZI', 'PZ.', 'PCS'].includes(um);
        if (!um1 || !um2 || pezzi(um1) === pezzi(um2) || !Number.isFinite(fattore) || fattore <= 0) return null;
        return { unita: pezzi(um1) ? um2 : um1, fattore,
            pezziPerUnita: pezzi(um1) ? 1 / fattore : fattore };
    }
    function calcola(valore, config) {
        const quantita = numero(valore);
        if (!config || !Number.isFinite(quantita) || quantita < 0) return null;
        const pezziTeorici = quantita * config.pezziPerUnita;
        const interoVicino = Math.round(pezziTeorici);
        const tolleranza = 8 * Number.EPSILON * Math.max(1, Math.abs(pezziTeorici));
        const pezzi = Math.abs(pezziTeorici - interoVicino) <= tolleranza
            ? interoVicino : Math.ceil(pezziTeorici);
        const quantitaGestionale = pezzi / config.pezziPerUnita;
        if (!Number.isSafeInteger(pezzi) || !Number.isFinite(quantitaGestionale)) return null;
        return { quantita, pezziTeorici, pezzi, quantitaGestionale };
    }
    const api = { numero, configurazione, calcola };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CalcoliBolla = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
