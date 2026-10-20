// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: recuperare gli articoli, caricare i template e inviare lo ZPL alle stampanti.

const fs = require('fs');
const path = require('path');
const net = require('net');
const { cercaArticoloEtichetta } = require('../db/queries');
const { normalizzaDatiStampa, creaCampiEtichetta, compilaZplEtichetta } = require('../utils/formattaEtichetta');

// Nome del file .PRN da seguire
const TEMPLATE_ETICHETTE = 'CAM_redesign_def_2.prn';

// Stampanti Zebra in rete
const STAMPANTI = {
    stampante1: { ip: '172.16.0.110', port: 9100 }, // Stampante dell'ufficio
    stampante2: { ip: '10.50.1.23', port: 9100 } // Stampante del box
};

function getConfigurazioneStampante(printerKey = 'stampante1') {
    const config = STAMPANTI[printerKey];
    return config ? { ...config } : null;
}

// Carica il file .PRN generato da Zebra e rimuove l'eventuale BOM iniziale.
function caricaTemplate(nomeFile) {
    const percorso = path.join(__dirname, '..', 'template_etichette', nomeFile);
    let contenuto = fs.readFileSync(percorso, 'utf8');
    if (contenuto.charCodeAt(0) === 0xFEFF) contenuto = contenuto.slice(1);
    return contenuto; // Restituisce il file intero, senza estrazione o fusione.
}

// Anteprima e stampa usano lo stesso flusso di compilazione.
async function generaZplArticolo(articolo, input) {
    const datiStampa = normalizzaDatiStampa(input);
    const datiArticolo = await cercaArticoloEtichetta(articolo);

    if (!datiArticolo) {
        const err = new Error('Articolo non trovato');
        err.status = 404;
        throw err;
    }

    const campi = creaCampiEtichetta(datiArticolo, datiStampa);
    const template = caricaTemplate(TEMPLATE_ETICHETTE);
    return compilaZplEtichetta(template, campi, datiStampa);
}

// Invia lo stesso ZPL usato per l'anteprima tramite socket TCP.
// Il template .PRN deve essere compatibile con modello, DPI e driver della stampante.
function stampaZpl(zpl, printerKey) {
    return new Promise((resolve, reject) => {
        const config = getConfigurazioneStampante(printerKey);
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

module.exports = { getConfigurazioneStampante, generaZplArticolo, stampaZpl };
