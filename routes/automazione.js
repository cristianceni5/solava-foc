// Scritto da Cristian Ceni 09/07/26
// Endpoint per l'attivazione automatica della riapertura finestre. Da combinare con il programma sui PC

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const configPath = path.join(__dirname, '../config/settaggi.json');

// Helper lettura file
async function leggiConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { consensoAuto: false };
    }
    throw err;
  }
}

// GET: risponde solo con "true" o "false"
router.get('/api/automazione', async (req, res) => {
  try {
    const config = await leggiConfig();
    const consenso = Boolean(config.consensoAuto);
    
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(consenso.toString());
  } catch (error) {
    console.error("Errore lettura configurazione:", error);
    res.status(500).send("false");
  }
});

// POST: aggiornamento impostazione
router.post('/api/set-automazione', async (req, res) => {
  const { consensoAuto } = req.body;

  try {
    const configAttuale = await leggiConfig();
    const nuovaConfig = {
      ...configAttuale,
      consensoAuto: Boolean(consensoAuto)
    };

    await fs.writeFile(configPath, JSON.stringify(nuovaConfig, null, 2), 'utf-8');
    res.json({ messaggio: "Valore scritto sul file di configurazione" });
  } catch (error) {
    console.error("Errore scrittura file:", error);
    res.status(500).json({ errore: "Impossibile scrivere il valore" });
  }
});

module.exports = router;