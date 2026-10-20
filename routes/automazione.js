// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: esporre le impostazioni per la riapertura automatica delle finestre sui PC.

const express = require('express');
const router = express.Router();
const { leggiConfig, aggiornaConfig } = require('../services/automazione');

const FINESTRA_RIAPERTA = 'Reparto - Factory Operation Panel';

// GET: risponde con le info per il programma sui PC
router.get('/api/automazione', async (req, res) => {
  try {
    const config = await leggiConfig();
    const consenso = config.consensoAuto === true || config.consensoAuto === 'true';
    const valoreMinuti = Number(config.minuti);
    const minuti = Number.isSafeInteger(valoreMinuti) && valoreMinuti >= 0 ? valoreMinuti : 0;

    // Restituisce l'array richiesto
    res.status(200).json([
      { 
        consenso: consenso, 
        minuti: minuti, 
        finestra: FINESTRA_RIAPERTA 
      }
    ]);
  } catch (error) {
    console.error("Errore lettura configurazione:", error);
    res.status(500).json({ errore: "Impossibile leggere la configurazione" });
  }
});

// POST: aggiornamento impostazione
router.post('/api/set-automazione', async (req, res) => {
  try {
    await aggiornaConfig(req.body);
    res.json({ messaggio: "Valore scritto sul file di configurazione" });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ errore: error.message });
    }
    console.error("Errore scrittura file:", error);
    res.status(500).json({ errore: "Impossibile scrivere il valore" });
  }
});

module.exports = router;
