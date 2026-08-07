// Scritto da Cristian Ceni 08/07/26
// Route per lo stato del server, risponde con lo stato

// Importo modulo express e creo un router express, metto anche il pool del DB per lo stato e il getReparto per l'URL
const express = require('express');
const router = express.Router();
const { getPool } = require('../db/pool');
const { getReparto } = require('../config/reparti');
const { eseguiQueryReparto } = require('../db/queries');
const { REPARTI } = require('../config/reparti');

// Definisco la route per l'API di stato
router.get('/api/stato', async (req, res) => {
  const idReparto = req.query.reparto;
  const reparto = getReparto(idReparto);

  if (!reparto) {
    return res.status(400).json({
      errore: `Reparto sconosciuto o mancante: "${idReparto}"`,
      tipoErrore: 'reparto_invalido',
    });
  }

  try {
    const righe = await eseguiQueryReparto(idReparto);

    const risposta = {
      ok: true,
      reparto: reparto.nome,
      dati: righe,
    };

    // Scarico Lingl e Scarico Capelletti mostrano anche Fornino - Termo1 accanto ai propri dati
    /*
    if (reparto.fornino) {
      risposta.datiFornino = await eseguiQueryReparto('fornino');
      risposta.nomeFornino = getReparto('fornino').nome;
    }
    */
    res.json(risposta);
  } catch (errore) {
    res.status(503).json({
      ok: false,
      reparto: reparto.nome,
      tipoErrore: 'db_non_disponibile',
      errore: 'Il database non risponde, riprova tra poco.',
      erroreRaw: errore.message,
    });
  }
});

// Route per i reparti, lo uso nella select del frontend per far scegliere il reparto
router.get('/api/reparti', (req, res) => {
  res.json(REPARTI);
});

// Esporto il router
module.exports = router;