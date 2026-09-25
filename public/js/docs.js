const DOCUMENTAZIONE = `
    <h1>Documentazione - Solava Factory Operation Panel (FOP)</h1>
    <p>Ultimo aggiornamento: <b>07/09/2026</b> | Autore: <b>Cristian Ceni</b></p>

    <h2>1. Funzionalità Principali</h2>
    <p>Factory Operation Panel (FOP) è un'interfaccia operativa con le seguenti funzioni attive:</p>
    <ul>
        <li><b>Monitoraggio Lavorazioni:</b> visualizzazione in tempo reale dello stato avanzamento e delle bolle di produzione attive per ciascun reparto.</li>
        <li><b>Stampa Etichette:</b> generazione e invio stampe verso i dispositivi Zebra dedicati (postazioni ufficio e box confezionamento).</li>
        <li><b>Controllo attributi estesi:</b> verifica degli attributi estesi associati ad ogni articolo.</li>
        <li><b>Gestione automazione per riapertura finestre:</b> sincronizzazione e persistenza dei consensi operativi tramite API dedicate e file di configurazione locale.</li>
    </ul>
    <p><i>Implementazioni pianificate:</i> gestione della coda pacchi sulle due linee di produzione e integrazione di moduli semplificati per transazioni MES di base.</p>

    <br>

    <h2>2. Architettura e Flusso Dati</h2>
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
        <li><code>/route</code>: definizione degli endpoint REST (reparti, etichette, automazione).</li>
        <li><code>/utils</code>: helper per formattazione dati e comunicazione con le stampanti.</li>
        <li><code>/public</code>: asset frontend statici (HTML, CSS, JS Vanilla).</li>
    </ul>

    <br>

    <h2>3. Gestione Servizio e Diagnostica</h2>

    <h3>Controllo del Servizio Windows</h3>
    <p>In produzione, FOP viene eseguito come servizio di sistema in background (<b>SolavaMMES</b>):</p>
    <ol>
        <li>Aprire la finestra <i>Esegui</i> (<kbd>Win</kbd> + <kbd>R</kbd>) e digitare <code>services.msc</code>.</li>
        <li>Individuare la voce <b>SolavaMMES</b> (<i>"Servizio per l'esecuzione automatica di Solava MMES Server"</i>).</li>
        <li>Fare clic con il tasto destro per:
            <ul>
                <li><b>Riavvia:</b> per applicare modifiche ai file sorgente o sbloccare anomalie di runtime.</li>
                <li><b>Arresta:</b> per disattivare l'ascolto sulla porta e chiudere il pool verso SQL Server.</li>
            </ul>
        </li>
    </ol>

    <h3>Debug e Analisi Errori</h3>
    <p>
        Poiché il servizio Windows non espone un terminale interattivo:
    </p>
    <ul>
        <li><b>Lato Client:</b> aprire la Console degli Strumenti di Sviluppo del browser (<kbd>F12</kbd> o <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) per verificare codici di stato HTTP e messaggi di errore restituiti dalle chiamate <code>fetch</code>.</li>
        <li><b>Lato Server (Debug Diretto):</b> arrestare il servizio da <code>services.msc</code>, aprire un prompt comandi nella cartella radice del progetto ed eseguire <code>npm start</code> per monitorare l'output dei log e le eccezioni non gestite in tempo reale.</li>
    </ul>

    <br>

    <h2>4. Codici di Stato ed Errori Ricorrenti</h2>
    <ul>
        <li><b>400 - Reparto sconosciuto o mancante:</b> l'identificativo reparto passato nei parametri URL o nel body della richiesta non corrisponde a un record valido in anagrafica.</li>
        <li><b>400 - Numero di etichette non valido:</b> il valore inviato non è un intero compreso nel range ammesso (1 - 999).</li>
        <li><b>400 - Pezzi per pacco non validi:</b> il parametro numerico deve essere un intero maggiore o uguale a 0.</li>
        <li><b>404 - Articolo non trovato:</b> il codice articolo specificato non è presente nell'anagrafica del database MES/SQL Server.</li>
        <li><b>500 - Failed to fetch / Errore di connessione:</b> la richiesta verso il backend è fallita. Il server Node.js potrebbe essere arrestato, non raggiungibile sulla porta 65535, o c'è un blocco a livello di firewall di rete.</li>
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