// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: avviare il server e collegare le pagine statiche e gli endpoint HTTP.

// Questo modulo serve per mettere le credenziali in un file env per tenerele fuori dal codice sorgente
require('dotenv').config();

// Importo modulo express e creo un'applicazione express
const express = require('express');
const path = require('node:path');
const app = express();
const diagnosticaRete = require('./middleware/diagnosticaRete').creaDiagnosticaRete();
app.use(diagnosticaRete.middleware);
app.use(express.json());
app.use(require('./routes/autenticazione'));
app.use(require('./middleware/accesso')());
// Segue le stesse regole di accesso delle altre API gestionali.
app.use(require('./routes/diagnosticaRete')(diagnosticaRete));
app.use(require('./routes/pcConnessi'));
app.use(require('./routes/meteo'));

//Butto fori la cartella public per servire i file statici, tipo index.html e gli altri file
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules/gsap/dist')));

// Importo il router per la route di stato
const statoRouter = require('./routes/stato');
app.use(statoRouter);

// Importo il router per la route delle etichette
const etichetteRouter = require('./routes/etichette');
app.use(etichetteRouter);

// Importo router per automazione finestra
const automRouter = require('./routes/automazione');
app.use(automRouter);

// Importo router per attributi esteso
const attrRouter = require('./routes/attributi');
app.use(attrRouter);

// Consultazione delle registrazioni di produzione nel database PLC.
app.use(require('./routes/salvataggi'));

// Porta del server sulla rete locale.
const PORT = 65535;

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
