// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: gestire gli endpoint HTTP per articolo, anteprima e stampa etichette.

const express = require('express');
const router = express.Router();
const { cercaArticoloEtichetta } = require('../db/queries');
const { creaRispostaArticolo } = require('../utils/normalizzaArticolo');
const { getConfigurazioneStampante, generaZplArticolo, stampaZpl } = require('../services/etichette');
const { generaAnteprimaEtichetta } = require('../services/anteprimaEtichetta');

// Espone l'indirizzo della stampante configurata, ai puri fini di UI non serve per il funzionamento
router.get('/api/etichette/stampante', (req, res) => {
    const { ip, port } = getConfigurazioneStampante();
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

        // Mantiene i nomi dei campi JSON utilizzati dal frontend.
        res.json(risposta);
    } catch (err) {
        console.error('Errore query etichetta:', err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

// Anteprima: genera lo ZPL e lo fa rendere da Labelary come immagine.
// Anteprima per l'operatore nel browser, senza invio alla stampante fisica.
router.get('/api/etichette/preview/:cod', async (req, res) => {
    try {
        const articolo = String(req.params.cod || '').trim();
        const { lotto, mostraCE, mostraICMQ, mostraStabilimento, invertiValoriUM, pezziPacco, pezziBLK, quantitaEtichette } = req.query;

        const zplFinale = await generaZplArticolo(articolo, { lotto, mostraCE, mostraICMQ, mostraStabilimento, invertiValoriUM, pezziPacco, pezziBLK, quantitaEtichette });

        const buffer = await generaAnteprimaEtichetta(zplFinale);
        res.set('Content-Type', 'image/png');
        res.send(buffer);

    } catch (err) {
        console.error('Errore preview etichetta:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Errore interno', dettaglio: err.dettaglio });
    }
});

// Route di stampa
router.post('/api/etichette/stampa/:cod/:stamp', async (req, res) => {
    try {
        const articolo = String(req.params.cod || '').trim();
        const stampante = String(req.params.stamp || 'stampante1').trim();

        const { lotto, mostraCE, mostraICMQ, mostraStabilimento, invertiValoriUM, pezziPacco, pezziBLK, quantitaEtichette } = req.body;

        const zplFinale = await generaZplArticolo(articolo, { lotto, mostraCE, mostraICMQ, mostraStabilimento, invertiValoriUM, pezziPacco, pezziBLK, quantitaEtichette });
        await stampaZpl(zplFinale, stampante);

        // La stampante Zebra non manda una vera conferma applicativa di stampa: questo timestamp
        // segna il momento in cui il socket TCP si e' chiuso dopo l'invio dei dati.
        // La chiusura del socket non conferma l'effettiva stampa fisica dell'etichetta.
        res.json({ ok: true, ricevutaIl: new Date().toISOString() });
    } catch (err) {
        console.error('Errore stampa etichetta:', err);
        const status = err.status || 500;
        res.status(status).json({ ok: false, errore: err.message || 'Errore interno' });
    }
});

module.exports = router;
