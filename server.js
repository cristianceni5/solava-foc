// Scritto da Cristian Ceni 08/07/26
// File principale del server

// Questo modulo serve per mettere le credenziali in un file env per tenerele fuori dal codice sorgente
require('dotenv').config();

// Importo modulo express e creo un'applicazione express
const express = require('express');
const app = express();

//Butto fori la cartella public per servire i file statici, tipo index.html e gli altri file
app.use(express.static('public'));

// Importo il router per la route di stato
const routerStato = require('./routes/stato');
app.use(routerStato);

// Importo il router per la route delle etichette
app.use(express.json());
const etichetteRouter = require('./routes/etichette');
app.use(etichetteRouter);

// Imposto la porta su cui il server ascolterà le richieste, per adesso è la 3000 ma si pole fare come si vole
const PORT = 65535;

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});