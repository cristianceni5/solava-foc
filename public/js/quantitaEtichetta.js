// Calcolo condiviso tra le sottocard nel browser e la compilazione ZPL sul server.
function calcolaQuantitaEtichetta(articolo, dati) {
    const doppia = articolo.stampaUnitaMisuraSecondaria;
    if (doppia && (!Number.isFinite(dati.pezziBLK) || dati.pezziBLK <= 0)) {
        throw new Error('Configurazione pezzi per BLK non valida per questo articolo');
    }
    const principale = doppia && dati.pezziPacco === Number(articolo.pezziPerPacco)
        ? Number(articolo.pezziPerPacco) / dati.pezziBLK : dati.pezziPacco;
    const secondariaCalcolata = articolo.um2 && Number.isFinite(articolo.fattoreConv)
        ? (principale * articolo.fattoreConv).toFixed(2) : '';
    const secondaria = doppia ? secondariaCalcolata : '';
    const blocchi = doppia && articolo.um2?.trim().toUpperCase() === 'BLK';
    const inverti = doppia && secondaria !== '' && dati.invertiValoriUM;
    return {
        principale,
        secondariaCalcolata,
        valore1: inverti ? secondaria : principale,
        valore2: inverti ? principale : secondaria,
        unita1: blocchi ? articolo.um2 : articolo.um1,
        unita2: doppia ? (blocchi ? articolo.um1 : articolo.um2) : ''
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcolaQuantitaEtichetta };
}
