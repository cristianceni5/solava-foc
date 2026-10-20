const DOCUMENTAZIONE = `
    <h1>Documentazione - Solava Factory Operation Panel (FOP)</h1>
    <p>Ultimo aggiornamento: <b>20/10/2026</b> - Autore: <b>Cristian Ceni</b></p>

    <h2>1. Funzionalità Principali</h2>
    <p>Factory Operation Panel (FOP) è un'interfaccia operativa con le seguenti funzioni attive:</p>
    <ul>
        <li><b>Monitoraggio Lavorazioni:</b> visualizzazione in tempo reale dello stato avanzamento e delle bolle di produzione attive per ciascun reparto.</li>
        <li><b>Stampa Etichette:</b> generazione e invio stampe verso i dispositivi Zebra dedicati (postazioni ufficio e box confezionamento).</li>
        <li><b>Controllo attributi estesi:</b> verifica degli attributi estesi associati ad ogni articolo.</li>
        <li><b>Salvataggi di prelavorazione:</b> consultazione delle registrazioni in tabella e report giornaliero, con calendario e confronto delle ricette PLC/MES.</li>
        <li><b>Gestione automazione per riapertura finestre:</b> sincronizzazione e persistenza dei consensi operativi tramite API dedicate e file di configurazione locale.</li>
    </ul>

    <br>

    <h2>2. Salvataggi di prelavorazione</h2>
    <p>Aprire <a href="paginaSalvataggi.html">Salvataggi</a> dal pannello e scegliere la vista nella barra orizzontale. La voce attiva è rossa e sottolineata.</p>
    <h3>Tabella</h3>
    <ul>
        <li>Mostra i salvataggi dal più recente, con 25 righe per pagina. Le prime colonne sono data e ora, ID, ricetta OMR, ricetta MES e tonnellate di terra; seguono i parametri delle linee e dei cassoni.</li>
        <li>Le righe alternano due sfondi. Selezionare una riga per aprire tutti i campi; <b>Apri report</b> porta al relativo evento nel report.</li>
        <li>Usare <b>Aggiorna dati</b> per rileggere le registrazioni. Se il caricamento fallisce, i dati già visibili vengono mantenuti e segnalati come precedenti.</li>
    </ul>
    <h3>Report e calendario</h3>
    <ul>
        <li>La vista <a href="paginaReportSalvataggi.html">Report</a> apre il riepilogo giornaliero. Il calendario indica quanti salvataggi caricati appartengono a ogni giorno; le frecce accanto alla data passano al giorno disponibile precedente o successivo.</li>
        <li>Il selettore orizzontale permette di scegliere <b>Riepilogo</b> oppure un singolo evento, identificato da ora e ID.</li>
        <li>La griglia raggruppa giornata o identificazione, ricette, ore di accensione e lavorazione delle linee 1 e 2, tonnellate di terra e frequenze dei cinque cassoni in Hz. Eventuali campi aggiuntivi compaiono in <b>Altri dati</b>.</li>
        <li>Nel riepilogo, ore, tonnellate e frequenze mostrano il minimo e il massimo rilevati nel giorno. Non sono somme o differenze di produzione. Se il valore resta invariato, compare una sola lettura.</li>
        <li>Gli zeri restano visibili; i dati mancanti sono indicati con un trattino. Le registrazioni senza data riconoscibile sono accessibili dalla voce <b>Senza data</b> nel calendario.</li>
    </ul>
    <h3>Confronto delle ricette</h3>
    <p>In tabella e report, i valori di <b>Ricetta OMR</b> e <b>Ricetta MES</b> sono verdi quando coincidono, gialli quando differiscono o uno dei due manca. Nel riepilogo giornaliero sono verdi solo se coincidono in tutti gli eventi del giorno.</p>
    <p>La consultazione carica al massimo gli ultimi <b>500 salvataggi</b>. Calendario, conteggi e riepiloghi riguardano esclusivamente i record caricati e possono quindi rappresentare solo una parte della giornata al limite dello storico disponibile.</p>

    <h2>3. Etichette e unità di misura</h2>
    <ol>
        <li>Aprire <a href="paginaEtichetta.html">Etichette</a> e cercare il codice articolo. Le ultime otto ricerche riuscite sono conservate nel browser.</li>
        <li>Verificare i pezzi per pacco e i pezzi per BLK, compilare il lotto quando richiesto e indicare da 1 a 999 etichette.</li>
        <li>Le sottocard UM1 e UM2 mostrano le quantità per pallet e si aggiornano modificando i pezzi. La quantità convertita usa il fattore dell'articolo: per A/6600, 405 PZ con fattore 0,045 producono il valore visualizzato di 18,22 MQ.</li>
        <li>UM2 può essere mostrata nella pagina anche se non abilitata per la stampa; in questo caso è indicata come <b>Non stampata</b>.</li>
        <li><b>Inverti i valori nelle UM</b> scambia le quantità associate alle due unità nell'anteprima e nella stampa. Le sigle delle unità restano ferme. L'opzione è disponibile per gli articoli con stampa della seconda unità; senza conversione disponibile non viene eseguito lo scambio.</li>
        <li>Scegliere se mostrare i marchi CE e ICMQ, generare l'anteprima, selezionare la stampante e confermare la stampa. Dopo l'invio il pulsante resta temporaneamente disabilitato per evitare doppioni.</li>
    </ol>
    <p>Anteprima e stampa usano lo stesso ZPL. L'anteprima viene generata tramite Labelary e può differire dalla resa fisica della stampante. Il messaggio di invio conferma la trasmissione dei dati, non l'avvenuta stampa del supporto.</p>
    <p>Per gli articoli BLK viene mantenuta la conversione dei pezzi in blocchi. Il calcolo delle quantità è condiviso tra browser e server nel file <code>public/js/quantitaEtichetta.js</code>.</p>

    <h2>4. Architettura e Flusso Dati</h2>
    <p>
        L'applicazione è distribuita come servizio sull'host <b>SLVW10BOX</b> ed è in ascolto sulla porta TCP <b>65535</b>.
        Il backend è strutturato su runtime Node.js con Express per l'esposizione degli endpoint REST, il modulo <code>mssql</code> per la persistenza e <code>dotenv</code> per la configurazione d'ambiente.
    </p>

    <h3>Topologia delle Connessioni</h3>
    <ul>
        <li><b>Client - Backend (HTTP/TCP):</b> i client browser della LAN aziendale si collegano a <code>http://SLVW10BOX:65535</code> per scaricare l'interfaccia statica (dalla cartella <code>/public</code>) ed eseguire chiamate API asincrone. Nessun client apre connessioni dirette verso il database.</li>
        <li><b>Backend - SQL Server (TDS sempre su TCP):</b> il backend Node.js gestisce un <b>Connection Pool singleton</b> verso MSSQL. Questo pattern garantisce che il carico sul database sia costante e controllato, prevenendo la saturazione delle connessioni anche in caso di accessi concorrenti multipli.</li>
    </ul>

    <h3>Configurazione e Sicurezza</h3>
    <ul>
        <li><b>File <code>.env</code>:</b> contiene i parametri sensibili per l'autenticazione a SQL Server (host, istanza, database, credenziali utente). Non deve essere esposto né tracciato in chiaro. In caso di riconfigurazione, fare riferimento al template <code>.env.example</code>.</li>
        <li><b>File <code>/config/settaggi.json</code>:</b> mantiene lo stato persistente delle configurazioni dell'applicazione (es. consenso automazione), gestito programmaticamente tramite gli endpoint <code>GET /api/automazione</code> e <code>POST /api/set-automazione</code>.</li>
    </ul>

    <h3>Struttura del Progetto</h3>
    <ul>
        <li><code>/config</code>: file di configurazione persistente e mapping statici.</li>
        <li><code>/db</code>: gestione del pool di connessione MSSQL e query di business logic.</li>
        <li><code>/services</code>: caricamento articoli e template, anteprima, invio ZPL e persistenza delle impostazioni di automazione.</li>
        <li><code>/routes</code>: definizione degli endpoint REST per reparti, etichette, attributi, automazione e salvataggi.</li>
        <li><code>/utils</code>: normalizzazione degli articoli, validazione e composizione dei campi e dei template ZPL.</li>
        <li><code>/public</code>: asset frontend statici (HTML, CSS, JS Vanilla).</li>
        <li><code>/test</code>: verifiche automatiche eseguibili con <code>npm test</code>.</li>
    </ul>
    <h3>Dati dei salvataggi</h3>
    <p><code>GET /api/salvataggi/prelavorazione</code> restituisce <code>ok</code>, <code>dati</code> e <code>limite</code>, senza cache. La query legge gli ultimi 500 record della tabella <code>dbo.SLV_T_SALVATAGGI_PRELAV</code>, ordinati per <code>DATA_ORA DESC</code>, nel database configurato tramite <code>DB_NOME_PLC</code>. Questa variabile è obbligatoria. Il database delle tabelle NVS è configurato tramite <code>DB_NOME</code>.</p>
    <p>Le pagine <code>paginaSalvataggi.html</code> e <code>paginaReportSalvataggi.html</code> condividono <code>public/js/salvataggi.js</code> e <code>public/css/salvataggi.css</code>. Il report accetta <code>?giorno=AAAA-MM-GG</code> oppure <code>?id=ID</code>. Data e ora delle registrazioni mantengono l'orario restituito dal database, senza conversione di fuso.</p>
    <h3>Stili condivisi</h3>
    <p><code>public/css/components.css</code> contiene i token del FOP, inclusi i colori di attenzione e conferma e gli stili dei checkbox. La tabella dei salvataggi usa gli stili condivisi delle lavorazioni. Nel report, titoli e valori usano il font heading; data e ora e i testi di accompagnamento usano il font base.</p>

    <br>

    <h2>5. Gestione Servizio e Diagnostica</h2>

    <h3>Controllo del Servizio Windows</h3>
    <p>In produzione, FOP viene eseguito come servizio di sistema in background (<b>Servizio Solava FOP</b>):</p>
    <ol>
        <li>Aprire la finestra <i>Esegui</i> (<kbd>Win</kbd> + <kbd>R</kbd>) e digitare <code>services.msc</code>.</li>
        <li>Individuare la voce <b>Servizio Solava FOP</b> (<i>"Servizio per l'esecuzione di Solava FOP Server"</i>).</li>
        <li>Fare clic con il tasto destro per:
            <ul>
                <li><b>Riavvia:</b> per applicare modifiche ai file sorgente o sbloccare anomalie di runtime.</li>
                <li><b>Arresta:</b> per disattivare l'ascolto sulla porta e chiudere il pool verso SQL Server.</li>
            </ul>
        </li>
    </ol>

    <h3>Debug e Analisi Errori</h3>
    <p>Per modifiche a HTML, CSS e JavaScript del browser, ricaricare con <kbd>Ctrl</kbd> + <kbd>F5</kbd>. Le modifiche al codice Node.js richiedono il riavvio del server o del servizio Windows.</p>
    <p>
        Poiché il servizio Windows non espone un terminale interattivo:
    </p>
    <ul>
        <li><b>Lato Client:</b> aprire la Console degli Strumenti di Sviluppo del browser (<kbd>F12</kbd> o <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) per verificare codici di stato HTTP e messaggi di errore restituiti dalle chiamate <code>fetch</code>.</li>
        <li><b>Lato Server (Debug Diretto):</b> arrestare il servizio da <code>services.msc</code>, aprire un prompt comandi nella cartella radice del progetto ed eseguire <code>npm start</code> per monitorare l'output dei log e le eccezioni non gestite in tempo reale.</li>
    </ul>

    <br>

    <h2>6. Codici di Stato ed Errori Ricorrenti</h2>
    <ul>
        <li><b>400 - Reparto sconosciuto o mancante:</b> l'identificativo reparto passato nei parametri URL o nel body della richiesta non corrisponde a un record valido in anagrafica.</li>
        <li><b>400 - Numero di etichette non valido:</b> il valore inviato non è un intero compreso nel range ammesso (1 - 999).</li>
        <li><b>400 - Pezzi per pacco non validi:</b> il parametro numerico deve essere un intero maggiore o uguale a 0.</li>
        <li><b>404 - Articolo non trovato:</b> il codice articolo specificato non è presente nell'anagrafica del database MES/SQL Server.</li>
        <li><b>Errore di connessione / Failed to fetch:</b> il browser non riesce a completare la richiesta al backend. Verificare server, porta 65535 e collegamento di rete; non è necessariamente presente un codice HTTP.</li>
        <li><b>500 - Errore interno:</b> la richiesta ha raggiunto il server, che ha riscontrato un errore. Consultare i log del servizio.</li>
        <li><b>503 - Il database non risponde:</b> il pool di connessione verso MSSQL è andato in timeout o il server SQL non accetta nuove sessioni. Attendere il ripristino o verificare lo stato dell'istanza DB.</li>
    </ul>


`;

function caricaNelDom() {
    const container = document.getElementById('container-docs');
    if (container) {
        container.innerHTML = `
            <div class="docs">
                ${DOCUMENTAZIONE}
            </div>
        `;
    }
}

caricaNelDom();
