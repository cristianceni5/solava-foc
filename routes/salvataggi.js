// Autore: Codex
// Ultima modifica: 10/10/2026
// Scopo: esporre gli ultimi salvataggi della prelavorazione per la consultazione.

const router = require('express').Router();
const { getSalvataggiPrelav } = require('../db/queries');

router.get('/api/salvataggi/prelavorazione', async (req, res) => {
    try {
        const dati = await getSalvataggiPrelav();
        res.set('Cache-Control', 'no-store');
        res.json({ ok: true, dati, limite: 500 });
    } catch (err) {
        console.error('Errore lettura salvataggi prelavorazione:', err);
        res.status(503).json({ ok: false, errore: 'Salvataggi non disponibili. Verifica il collegamento al database e riprova.' });
    }
});

module.exports = router;
