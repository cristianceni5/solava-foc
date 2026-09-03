// Scritto da Cristian Ceni 02/09/26
// Endpoint per il controllo degli attributi estesi.

const express = require('express');
const router = express.Router();
const { cercaArticoloAttributi } = require('../db/queries');

// GET per gli attributi in baso a un articolo, restituisce un oggetto con i campi di TeamSystem pari pari.
router.get('/api/attributi/articolo/:cod', async (req, res) => {
    const articolo = String(req.params.cod || '').trim();

    if (!articolo) {
        return res.status(400).json({ error: 'Codice articolo mancante' });
    }

    try {
        const datiArticolo = await cercaArticoloAttributi(articolo);

        if (!datiArticolo) {
            return res.status(404).json({ error: 'Articolo non trovato' });
        }

        const risposta = datiArticolo;

        // Risposta in JSON, occhio a modificare i nomi degli id perchè al 69% si rompe 
        res.json(risposta);
    } catch (err) {
        console.error('Errore query attributi:', err);
        res.status(500).json({ error: 'Errore interno' });
    }
});

module.exports = router;
