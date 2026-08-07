# Documentazione sugli impianti di Solava SpA.

- Scritta da Cristian Ceni il 21/07/26

## Contesto industriale

- Solava è una fornace e produce mattoni, tegole e laterizi vari. Sito web visitabile: `https://www.solava.it`

## Struttura gerarchica

- Amministrazione
- Vendite
- Produzione

## Reparti e linee

- Solava ha 2 linee di produzione, una per le **tegole** e prodotti simili, l'altra per **mattoni**, **cimase** e prodotti simili.

### Struttura delle linee

- Ogni linea ha in partenza l'**estrusione** dove il materiale esce dalla trafila in stato **verde** e va verso il reparto dei **seccatoi**, in cui da verde passa a **secco**, dopodichè il secco viene caricato nei carri diretti verso il **forno**. Dopo la cottura il materiale passa la sua ultima fase, lo scarico del **cotto**, in cui viene già ricomposto e messo sui pallet. Dopo procedono al fornino termoretraibile che sigilla i pacchi e ci applica l'etichetta.

### Linea 1 - Lingl
- La linea 1 come anticipato produce mattoni, cimase, frangisole, pianelle, battiscopa, portabottiglie, ... gli impianti sono della tedesca **Lingl**.
A livello tecnico tutto è dei primi anni 2000, per cui S7 300 e 400 per quanto riguarda tutto il lato macchine. Mentre sono applicati S7 1200/1500 per la comunicazione e la trasmissione dei dati utili al MES come i `pezzi_carro`, `pezzi_cop` ecc.

### Linea 2 - Capelletti
- La linea 2 si occupa di tegole romane, gronde, coppi ed ha un sotto reparto di pressa in cui fanno colmi e abbellimenti vari in laterizio. L'impianto è misto A. Capelletti e Capaccioli Srl. Il funzionamento è analogo a quello dell'altra linea. Per quanto riguarda la parte tecnica qui siamo 10 passi indietro. A. Capelletti ha fatto quell'impianto nell'ormai lontano '94 quindi ci puoi trovare S5 e vecchi Omron, Capaccioli ha qualche annno in meno, '97/'98 per cui Omron di circa quell'età. Anche qui vengono usati esclusivamente per lo scarico S7 1200 per la comunicazione dei pezzi a PowerMES tramite OPC UA.

### Elenco di tutti in reparti

- 1 Cava - Prelavorazione delle argille
- 2 Trafila Lingl
- 3 Trafile Capelletti
- 4 Carico Lingl
- 5 Carico Capelletti
- 6 Scarico Lingl
- 7 Scarico Capelletti
- 8 Fornino - Termo1

## Dove il MES lavora?

- Il MES nella produzione è in funziona su 8 PC in ogni reparto. Fondamentalmente l'operatore fa il login al MES.FrontEnd, avvia la sua lavorazione e se necessario versa il prodotto fatto fino a quel momento. Il versamento è obbligatorio in tutte le fasi, meno che **Scarico Lingl/Cape** e **Fornino** che funzionano con **PowerMES**. A questo proposito, lo scarico ha più lavorazioni essenziali, la prima è `PRELIEVO_REPARTO` con un operatore presidiato che deve solo avviare la lavorazione, poi automaticamente parte `RICOMPOSIZIONE_REPARTO` che conta i pezzi che la macchina ricompone, moltiplicando il numero di pinzate effettuate con il numero dei pezzi per pinzata, dopo questo valore arriva a `FORNINO TERMORETRAIBILE` che anch'esso versa automaticamente con PowerMES ed arriva all'etichettatura. Riassumendo solo `PRELIEVO` ha un operatore presidiato mentre le altre fasi usano PowerMES. 

- Nelle vendite e nell'amministrazione viene usato di più il magazzino grafico di TS e il backend per mandare le lavorazioni qui in produzione e quella è la cosa più complicata.

## Come siamo messi ora per il Solava MMES sviluppato da Ceni?

- Allora, ora Solava MMES gira sul PC/Server SLVW10BOX sulla porta 65535, gli operatori si connettono al suo indirizzo con la porta e navigano `paginaReparto.html` e `paginaEtichetta.html` rispettivamente per controllare le lavorazioni aperte date da una tabella nel DB `SOLAVA_MES` e per compilare le etichette prendendo i dati da una tabella del DB in cui ci sono gli attributi estesi per ogni articolo.

- Va ristrutturato di sicuro su diversi aspetti, di certo togliere gli script inline e le query dentro i js