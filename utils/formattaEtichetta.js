// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: validare i dati, calcolare i campi e compilare lo ZPL senza accesso a DB, file o rete.

const { componiZPL, componiTimestamp, estraiEtichettaReale, rimuoviLogoCE, rimuoviLogoICMQ } = require('./componiZpl');
const { calcolaQuantitaEtichetta } = require('../public/js/quantitaEtichetta');

function erroreValidazione(messaggio) {
    const errore = new Error(messaggio);
    errore.status = 400;
    return errore;
}

function leggiIntero(valore, nome, minimo, massimo = Infinity) {
    if (valore === '' || valore === null || valore === undefined) {
        throw erroreValidazione(`${nome} obbligatorio`);
    }

    const numero = Number(valore);
    if (!Number.isInteger(numero) || numero < minimo || numero > massimo) {
        throw erroreValidazione(`${nome} non valido`);
    }
    return numero;
}

function normalizzaDatiStampa(input = {}) {
    const lotto = String(input.lotto ?? '').trim();
    if (/[\^~]/.test(lotto)) {
        throw erroreValidazione('Il lotto contiene caratteri non validi');
    }

    return {
        lotto,
        mostraCE: input.mostraCE !== 'false' && input.mostraCE !== false,
        mostraICMQ: input.mostraICMQ !== 'false' && input.mostraICMQ !== false,
        mostraStabilimento: input.mostraStabilimento !== 'false' && input.mostraStabilimento !== false,
        invertiValoriUM: input.invertiValoriUM === 'true' || input.invertiValoriUM === true,
        pezziPacco: leggiIntero(input.pezziPacco, 'I pezzi per pacco', 0),
        pezziBLK: leggiIntero(input.pezziBLK, 'I pezzi per BLK', 1),
        quantitaEtichette: leggiIntero(input.quantitaEtichette, 'Il numero di etichette', 1, 999)
    };
}

// Riceve l'articolo normalizzato e i parametri validati da normalizzaDatiStampa.
function creaCampiEtichetta(datiArticolo, datiStampa, data = new Date()) {
    if (datiArticolo.stampaLotto && !datiStampa.lotto) {
        throw erroreValidazione('Il lotto Ã¨ obbligatorio per questo articolo');
    }

    const quantita = calcolaQuantitaEtichetta(datiArticolo, datiStampa);
    const progressivo = componiTimestamp(data);

    // Costruzione dell'etichetta secondo i campi corretti
    const dati = {
        ...datiArticolo.campiZpl,
        ARTICOLO: datiArticolo.codice,
        DESCRIZIONE: datiArticolo.descrizione,
        DESCR_AGG: datiArticolo.descrizioneAggiuntiva,
        // Usa la quantita' modificata dall'operatore oppure quella ricavata dal DB.
        PEZZI_PACCO: quantita.valore1,
        MT_PACCO: quantita.valore2,
        COD_LOTTO: datiStampa.lotto,
        PROGRESSIVO: progressivo,
        BARCODE: datiStampa.lotto,
        MARCATURA: datiStampa.mostraCE ? (datiArticolo.numeroMarcaturaCE || '') : '',
        ENTE: datiStampa.mostraCE ? datiArticolo.enteCertificatore : '',
        DOP: datiStampa.mostraCE ? datiArticolo.dop : '',
        NORMA: datiStampa.mostraCE ? datiArticolo.norma : '',
        CAMPO_1: datiArticolo.campiZpl.CLASSIFICAZIONE,
        CAMPO_2: datiArticolo.categoria,
        UM1: quantita.unita1 + '/Pallet',
        UM2: quantita.unita2 ? quantita.unita2 + '/Pallet' : '',
        LINK: 'https://www.solava.it',
        QR: `${datiArticolo.codice};${datiStampa.lotto};${quantita.principale}`
    };

    return dati;
}

// Compila il template e applica le opzioni dei loghi e il numero di copie.
function compilaZplEtichetta(template, dati, datiStampa) {
    const templateUnificato = estraiEtichettaReale(template);
    let zplFinale = componiZPL(templateUnificato, dati);
    if (!datiStampa.mostraCE) zplFinale = rimuoviLogoCE(zplFinale);
    if (!datiStampa.mostraICMQ) zplFinale = rimuoviLogoICMQ(zplFinale);
    if (datiStampa.mostraStabilimento === false) {
        zplFinale = zplFinale.replace(/\^FT[^\r\n]*?\^FDStabilimento di produzione[^\r\n]*?\^FS/g, '');
    }
    // ^PQ definisce la quantita' di stampa (^PQ1,0,1,Y nel template): sostituisce solo il numero.
    zplFinale = zplFinale.replace(/\^PQ\d+,/, `^PQ${datiStampa.quantitaEtichette},`);
    return zplFinale;
}
module.exports = { normalizzaDatiStampa, creaCampiEtichetta, compilaZplEtichetta };
