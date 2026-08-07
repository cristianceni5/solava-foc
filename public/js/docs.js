const DOCUMENTAZIONE = `
    <h1>Documentazione e funzionamento di Solava Factory Operation Panel</h1>
    <p>Documento scritto il 28/07/26 da <b>Cristian Ceni</b></p>

    <br>

    <h2>Funzionalità</h2>
    <p>Ad oggi Factory Operation Panel (da ora in poi FOP). ha 2 funzioni principali:</p>
    <ul>
        <li>Controllare le lavorazioni con una bolla attiva in quel tale momento</li>
        <li>Stampare le etichette con le stampanti Zebra (ufficio e box)</li>
    </ul>
    <p>In futuro sono previste aggiunte per la coda dei pacchi nelle 2 linee e una gestione più semplice per operazioni basi lato MES</p>

    <br>

    <h2>Funzionamento</h2>
    <p>
        FOP è un servizio hostato su <b>SLVW10BOX</b> sulla porta <b>65535</b>. Dietro c'è un server Node.js con librerie standard per: la comunicazione con SQL Server,
        dotenv per le variabili d'ambiente ed express per le route API da cui le 2 pagine paginaReparto e paginaEtichetta prendono le loro informazioni.
    </p>
    <p>
        In questa configurazione i PC connessi al FOP <b>non aprono mai una connessione verso SQL-Server</b>, ma sfruttano SLVW10BOX che è l'unico ad avere un pool di connessioni
        con MSSQL. Il codice è scritto per non creare mai più di un pool se il precedente è attivo, in questo modo il DB <b>non si satura</b> di richieste anche se ci sono più PC connessi al pannello.
        Quindi tecnicamente tutti i PC della rete possono connettersi a SLVW10BOX:65535 tramite un semplice browser, comunicano tramite <b>HTTP/TCP</b>, poi il backend Node.js con il pool
        verso il DB comunica con <b>TDS</b> mantendendo tutto logico e affidabile.
    </p>
    <p>
        Per la configurazione è necessario un file dotenv per le <b>variabili d'ambiente</b>.
        Quest'ultime sono le informazioni sensibili per la connessione a MSSQL (nome DB, utente, password), per cui devono stare in un file separato, raggiungibile tramite gli script del server e mai messe in chiaro.
        Non essenziale nel nostro caso dato che il FOP è usato nella rete aziendale, ma comunque meglio partire prevenuti per futuri ampliamenti che potrebbero prevedere un uso anche esterno dalla LAN.
        Il file dotenvdotexample è il file placeholder con i campi necessari per il funzionamento. In caso di perdita del dotenv principale, ricrearlo da quel template.
    </p>
    <p>
        I file del server Node.js sono tutti nelle cartelle /config, /db, /utils, /route e la /public per i file esposti sulla 65535. I nomi delle cartelle parlono già da soli, gli script sono
        volutamente logicamente semplici e pieni di commmenti per aiutare nella compresione del codice una persona esterna. 
    </p>
    
    <br>

    <h2>Errori possibili e soluzioni</h2>
    <h3>Nota importante</h3>
    <p>
        Nel normale esercizio, FOP è un servizio in esecuzione automatica, quindi non ha un terminale da cui poter vedere i log direttamente. Però è possibile controllare la console nel browser
        per del semplice debug. Se i problemi persistono senza una spiegazione, arrestare il servizio, aprire un terminale dentro la dir del progetto, eseguire npm start e controllare i log in tempo reale
        nel terminale appena aperto.
    </p>
    <p>Questi errori non sempre compaiono direttamente a schermo, questo per la volontà di tenerlo uno strumento semplice alla vista. Quindi necessario aprire la console del browser per una diagnostica più affidabile</p>
    <h3>Qui l'elenco</h3>
    <p>
        <ul>
            <li><b>Reparto sconosciuto o mancante - 400</b></li>
            <p>Il reparto selezionato non corrisponde a nessuno di quelli presenti, controlla il nome.</p>

            <li><b>Il numero di etichette deve essere un intero compreso tra 1 e 999 - 400</b></li>
            <p>Attenzione al numero etichette.</p>

            <li><b>I pezzi per pacco devono essere un intero uguale o maggiore di zero - 400</b></li>
            <p>Attenzione ai pezzi pacco.</p>

            <li><b>Articolo non trovato - 404</b></li>
            <p>L'articolo inserito risulta non trovato, controlla di averlo inserito bene.</p>

            <li><b>Il database non risponde, riprova tra poco - 503</b></li>
            <p>Come scritto, attendere qualche minuto in attesa e controllare se il DB riprende.</p>

            <li><b>Failed to fetch - 500</b></li>
            <p>La chiamata al backend Node.js è fallita. Alta probabilità che il server ha interrotto l'esecuzione di FOP.</p>
        </ul>
    </p>
    `;

function caricaNelDom() {
    const container = document.getElementById('container-docs');
    container.innerHTML = `
        <div class="docs">
            ${DOCUMENTAZIONE}
        </div>
    `;
}

caricaNelDom();

