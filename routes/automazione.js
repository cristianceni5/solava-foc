// Scritto da Cristian Ceni 04/09/26
// Endpoint per l'attivazione automatica della riapertura finestre. Da combinare con il programma sui PC

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const configPath = path.join(__dirname, '../config/settaggi.json');
const FINESTRA_RIAPERTA = 'Reparto - Factory Operation Panel';

// Helper lettura file
async function leggiConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { consensoAuto: false, minuti: 0 }; // Valori di default se il file non esiste
    }
    throw err;
  }
}

// GET: risponde con le info per il programma sui PC
router.get('/api/automazione', async (req, res) => {
  try {
    const config = await leggiConfig();
    const consenso = Boolean(config.consensoAuto);
    const minuti = Number.isFinite(Number(config.minuti)) ? Number(config.minuti) : 0;

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
  const { consensoAuto, minuti } = req.body;

  try {
    const configAttuale = await leggiConfig();
    
    // Parsing sicuro: se non è un numero valido mantiene quello attuale o imposta 0
    const parsedMinuti = Number.parseInt(minuti, 10);
    const minutiSicuri = Number.isNaN(parsedMinuti) ? (configAttuale.minuti ?? 0) : parsedMinuti;

    const nuovaConfig = {
      ...configAttuale,
      consensoAuto: consensoAuto !== undefined ? Boolean(consensoAuto) : Boolean(configAttuale.consensoAuto),
      minuti: minutiSicuri
    };

    await fs.writeFile(configPath, JSON.stringify(nuovaConfig, null, 2), 'utf-8');
    res.json({ messaggio: "Valore scritto sul file di configurazione" });
  } catch (error) {
    console.error("Errore scrittura file:", error);
    res.status(500).json({ errore: "Impossibile scrivere il valore" });
  }
});

module.exports = router;