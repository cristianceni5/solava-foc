// Scritto da Cristian Ceni 09/07/26
// Compilazione delle etichette

const express = require('express');
const router = express.Router();
const { cercaArticoloEtichetta } = require('../db/queries');
const { creaRispostaArticolo } = require('../utils/normalizzaArticolo');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { componiZPL, componiTimestamp, estraiEtichettaReale, rimuoviLogoCE, rimuoviLogoICMQ } = require('../utils/componiZpl');

// Nome del file .PRN da seguire
const TEMPLATE_ETICHETTE = 'CAM_redesign_def_2.prn';

// Stampanti Zebra in rete
const STAMPANTI = {
    stampante1: { ip: '172.16.0.110', port: 9100 }, // Stampante dell'ufficio
    stampante2: { ip: '10.50.1.23', port: 9100 } // Stampante del box
};

// Espone l'indirizzo della stampante configurata, ai puri fini di UI non serve per il funzionamento
router.get('/api/etichette/stampante', (req, res) => {
    const { ip, port } = STAMPANTI.stampante1;
    res.json({ ip, port });
});

// Route di selezione articolo dal DB
router.get('/api/etichette/articolo/:cod', async (req, res) => {
    const articolo = String(req.params.cod || '').trim();

    if (!articolo) {
        return res.status(400).json({ error: 'Codice articolo mancante' });
    }

    try {
        const datiArticolo = await cercaArticoloEtichetta(articolo);

        if (!datiArticolo) {
            return res.status(404).json({ error: 'Articolo non trovato' });
        }

        const risposta = creaRispostaArticolo(datiArticolo);

        // Risposta in JSON, occhio a modificare i nomi degli id perchè al 69% si rompe 
        res.json(risposta);
    } catch (err) {
        console.error('Errore query etichetta:', err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// Funzione per caricamento file .PRN generato da Zebra. Scritto anche sotto ma fare attenzione al driver
function caricaTemplate(nomeFile) {
    const percorso = path.join(__dirname, '..', 'template_etichette', nomeFile);
    let contenuto = fs.readFileSync(percorso, 'utf8');
    if (contenuto.charCodeAt(0) === 0xFEFF) contenuto = contenuto.slice(1);
    return contenuto; // ← nessuna estrazione/fusione, file intero così com'è
}

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
        pezziPacco: leggiIntero(input.pezziPacco, 'I pezzi per pacco', 0),
        pezziBLK: leggiIntero(input.pezziBLK, 'I pezzi per BLK', 1),
        quantitaEtichette: leggiIntero(input.quantitaEtichette, 'Il numero di etichette', 1, 999)
    };
}

// Funzione condivisa: costruisce lo ZPL finale per un articolo.
// Usata sia dalla preview (Labelary) sia dalla stampa reale (socket stampante),
async function generaZplArticolo(articolo, { lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette }) {
    const datiStampa = normalizzaDatiStampa({ lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette });

    const datiArticolo = await cercaArticoloEtichetta(articolo);

    if (!datiArticolo) {
        const err = new Error('Articolo non trovato');
        err.status = 404;
        throw err;
    }
    if (datiArticolo.stampaLotto && !datiStampa.lotto) {
        throw erroreValidazione('Il lotto Ã¨ obbligatorio per questo articolo');
    }

    // Calcolo delle quantità effettive - articolo con o senza doppia UM
    const doppiaUnita = datiArticolo.stampaUnitaMisuraSecondaria;
    const pezziPerBLK = Number(datiArticolo.pezziPerSec ?? datiStampa.pezziBLK);
    if (doppiaUnita && (!Number.isFinite(pezziPerBLK) || pezziPerBLK <= 0)) {
        throw new Error('Configurazione pezzi per BLK non valida per questo articolo');
    }

    const quantEffettivaPrinc = doppiaUnita && datiStampa.pezziPacco === Number(datiArticolo.pezziPerPacco)
        ? Number(datiArticolo.pezziPerPacco) / pezziPerBLK
        : datiStampa.pezziPacco;

    const quantEffettivaSec = doppiaUnita && Number.isFinite(datiArticolo.fattoreConv)
        ? (quantEffettivaPrinc * datiArticolo.fattoreConv).toFixed(2)
        : '';

    // Calcolo effettivo delle UM - maledetti
    const um1Eff = doppiaUnita ? datiArticolo.um2 + "/Pallet" : datiArticolo.um1 + "/Pallet";
    const um2Eff = doppiaUnita ? datiArticolo.um1 + "/Pallet" : "";

    // Per adesso il progressivo non viene mostrato
    const progressivo = componiTimestamp(new Date());

    // Costruzione dell'etichetta secondo i campi corretti
    const dati = {
        ...datiArticolo.campiZpl,
        ARTICOLO: datiArticolo.codice,
        DESCRIZIONE: datiArticolo.descrizione,
        DESCR_AGG: datiArticolo.descrizioneAggiuntiva,
        // Se l'operatore ha modificato il campo in pagina uso quel valore, sennò quello del DB
        PEZZI_PACCO: quantEffettivaPrinc,
        MT_PACCO: quantEffettivaSec,
        COD_LOTTO: datiStampa.lotto,
        PROGRESSIVO: progressivo,
        BARCODE: datiStampa.lotto,
        MARCATURA: datiStampa.mostraCE ? (datiArticolo.numeroMarcaturaCE || '') : '',
        ENTE: datiStampa.mostraCE ? datiArticolo.enteCertificatore : '',
        DOP: datiStampa.mostraCE ? datiArticolo.dop : '',
        NORMA: datiStampa.mostraCE ? datiArticolo.norma : '',
        CAMPO_1: datiArticolo.campiZpl.CLASSIFICAZIONE,
        CAMPO_2: datiArticolo.categoria,
        UM1: um1Eff,
        UM2: um2Eff,
        LINK: 'https://www.solava.it',
        QR: `${datiArticolo.codice};${datiStampa.lotto};${quantEffettivaPrinc}`
    };

    // Qui carico il template, sceglilo dall'oggetto in alto TEMPLATE, sennò se sbagli una lettera non va più nullaa
    const template = caricaTemplate(TEMPLATE_ETICHETTE);

    const templateUnificato = estraiEtichettaReale(template);
    let zplFinale = componiZPL(templateUnificato, dati);
    if (!datiStampa.mostraCE) zplFinale = rimuoviLogoCE(zplFinale);
    if (!datiStampa.mostraICMQ) zplFinale = rimuoviLogoICMQ(zplFinale);
    // ^PQ è il comando ZPL di quantità di stampa (^PQ1,0,1,Y nel template): sostituisco solo il numero
    zplFinale = zplFinale.replace(/\^PQ\d+,/, `^PQ${datiStampa.quantitaEtichette},`);
    return zplFinale;
}

// Anteprima: genera lo ZPL e lo fa rendere da Labelary come immagine.
// Solo per l'operatore nel browser — non tocca la stampante fisica.
router.get('/api/etichette/preview/:cod', async (req, res) => {
    try {
        const articolo = String(req.params.cod || '').trim();
        const { lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette } = req.query;

        const zplFinale = await generaZplArticolo(articolo, { lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette });

        const labelaryRes = await fetch(
            'http://api.labelary.com/v1/printers/12dpmm/labels/5.91x8.27/0/',  // ← indice 0
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'image/png',
                },
                body: zplFinale
            }
        );

        if (!labelaryRes.ok) {
            const testoErrore = await labelaryRes.text();
            console.error('Labelary ha rifiutato lo ZPL:', labelaryRes.status, testoErrore);
            return res.status(502).json({ error: 'Labelary ha rifiutato lo ZPL', dettaglio: testoErrore });
        }

        const buffer = await labelaryRes.arrayBuffer();
        res.set('Content-Type', 'image/png');
        res.send(Buffer.from(buffer));

    } catch (err) {
        console.error('Errore preview etichetta:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Errore interno' });
    }
});

// Stampa reale: stesso ZPL della preview, attenzione qui che il file .PRN abbia la stessa config con il driver della stampante giusto
// Controlla modello, DPI e poi eseguire test sul designer. Ci perdi una mattinata sennò
function stampaZpl(zpl, printerKey) {
    return new Promise((resolve, reject) => {
        const config = STAMPANTI[printerKey];
        if (!config) {
            return reject(new Error(`Stampante '${printerKey}' non configurata`));
        }
        const { ip, port } = config;
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error('Timeout connessione stampante'));
        }, 5000);

        client.connect(port, ip, () => {
            client.write(zpl, 'utf8', () => {
                client.end();
            });
        });

        client.on('close', () => {
            clearTimeout(timeout);
            resolve();
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Route di stampa
router.post('/api/etichette/stampa/:cod/:stamp', async (req, res) => {
    try {
        const articolo = String(req.params.cod || '').trim();
        const stampante = String(req.params.stamp || 'stampante1').trim();

        const { lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette } = req.body;

        const zplFinale = await generaZplArticolo(articolo, { lotto, mostraCE, mostraICMQ, pezziPacco, pezziBLK, quantitaEtichette });
        await stampaZpl(zplFinale, stampante);

        // La stampante Zebra non manda una vera conferma applicativa di stampa: questo timestamp
        // segna il momento in cui il socket TCP si è chiuso correttamente dopo l'invio dei dati,
        // che è il segnale più affidabile disponibile senza interrogare lo stato della stampante.
        res.json({ ok: true, ricevutaIl: new Date().toISOString() });
    } catch (err) {
        console.error('Errore stampa etichetta:', err);
        const status = err.status || 500;
        res.status(status).json({ ok: false, errore: err.message || 'Errore interno' });
    }
});

module.exports = router;
