// Scritto da Cristian Ceni 17/07/26
// Da eseguire una volta sola!!

// File per la creazione del servizio Windows, di modo che all'avvio il server parta subito, qualsiasi cosa accada

var Servizio = require('node-windows').Service;

var srvz = new Servizio({
    name: "Servizio Solava FOP",
    description: "Servizio per l'esecuzione di Solava FOP Server",
    script: 'C:/Users/Confezionamento/Documents/Factory Operation Panel - Solava/server.js'
});

srvz.on('install', function()
{
    srvz.start();
});

srvz.install();

