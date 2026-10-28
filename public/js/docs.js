// Autori: Cristian Ceni
// Ultima modifica: 28/10/2026
// Scopo: documentazione di FOP

const DOCUMENTAZIONE = `
    <h1>Documentazione - Solava Factory Operation Panel (FOP)</h1>
    <p>Ultimo aggiornamento: <b>28/10/2026</b> - Autore: <b>Cristian Ceni</b></p>

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
        <li><b>File <code>/config/settaggi.json</code>:</b> mantiene lo stato persistente delle configurazioni dell'applicazione (es. consenso automazione), gestito programmaticamente tramite gli endpoint <code>GET /api/impostazioni</code> e <code>POST /api/set-automazione</code>. Il precedente <code>GET /api/automazione</code> conserva il contratto pubblico usato dal servizio di riapertura.</li>
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

    <h3>Accesso e impostazioni</h3>
    <p>Il file <code>config/utenti.json</code> contiene un array di utenti con i campi <code>utente</code> e <code>password</code>. Le password sono attualmente in chiaro e il file resta sul server. Il login crea una sessione di otto ore tramite cookie HttpOnly e SameSite Strict; al riavvio del servizio tutte le sessioni vengono invalidate.</p>
    <p>In <code>config/settaggi.json</code>, <code>richiediAuth: true</code> richiede il login per il pannello, gli strumenti, i salvataggi, la documentazione e i PC connessi, comprese le relative API. I monitor reparto e le API necessarie al monitor e alla riapertura automatica rimangono accessibili. Il consenso si modifica dal dialog Impostazioni ed è applicato alle richieste successive. Le pagine protette rimandano al login; le API rispondono con 401.</p>
    <h3>Computer connessi: tabella, report ed Excel</h3>
    <p>Aprire <a href="paginaPcConnessi.html">PC Connessi</a> dal pannello. La tabella mostra 25 record per pagina, con IP, stato, ultima pagina, reparto, primo accesso e ultimo contatto. Il reparto deriva esclusivamente dal parametro <code>reparto</code> della pagina monitor, ad esempio <code>paginaReparto.html?reparto=cava</code>, e il nome proviene da <code>config/reparti.js</code>. I parametri delle altre pagine non vengono registrati. Un reparto non riconosciuto è indicato come tale.</p>
    <p>Il browser invia un segnale ogni 30 secondi; un PC è attivo entro 90 secondi dall'ultimo contatto. L'elenco si aggiorna ogni 15 secondi e mantiene la pagina selezionata; è disponibile anche Aggiorna dati. Il registro <code>config/pcConnessi.json</code> conserva una voce per IP, con l'ultima pagina e l'ultimo reparto segnalati: più schede o PC dietro lo stesso IP non costituiscono sessioni distinte. Il rallentamento dei timer del browser può far apparire un PC non attivo.</p>
    <p>Il <a href="paginaReportPcConnessi.html">Report</a> mostra il riepilogo della data selezionata e il dettaglio giornaliero di ogni IP. Il componente condiviso <code>public/js/reportTabella.js</code> riceve record, colonne, chiave del record e regole di riepilogo, senza dipendere da una particolare API. L'esportazione usa tutte le righe caricate, anche quelle nelle altre pagine, nel formato HTML compatibile con Excel con estensione .xls. Non viene eseguita alcuna ricerca DNS inversa.</p>

<p>Lo storico d'uso dei PC inizia con l'attivazione della raccolta giornaliera e conserva fino a 90 giorni rilevati per IP nel registro. Il report ha un selettore data con navigazione tra le giornate disponibili. Le rilevazioni sono segnali di presenza, non visite o clic. Il tempo osservato somma solo intervalli consecutivi fino a 90 secondi nello stesso giorno: è una stima di presenza del FOP, non del lavoro umano. I giorni precedenti all'attivazione non vengono ricostruiti. L'Excel del report esporta tutti i PC della giornata selezionata.</p>
    <h3>Come leggere il report dei computer</h3>
    <p>Computer rilevati conta gli indirizzi IP distinti della giornata. Tempo osservato somma le finestre di presenza stimate dei PC, anche simultanee: non misura il tempo di utilizzo effettivo o le ore di lavoro degli operatori. Rilevazioni ricevute conta i segnali periodici, non i clic o le visite. Il grafico a ciambella mostra il peso di ogni pagina e reparto sul totale delle rilevazioni; il selettore Computer permette di consultare un singolo computer. Prima e ultima rilevazione indicano gli estremi dei segnali ricevuti, senza misurare il tempo di utilizzo effettivo.</p>
    <h3>Come leggere il report della prelavorazione</h3>
    <ul>
        <li><b>Giornata e singolo evento:</b> scegli una data per il riepilogo oppure un salvataggio per consultarne le letture. L'intervallo tra prima e ultima registrazione indica la copertura dei dati disponibili, non le ore di lavoro dell'impianto.</li>
        <li><b>Ricette:</b> verde indica ricette OMR e MES coincidenti; giallo indica valori diversi o incompleti, da verificare nel singolo evento.</li>
        <li><b>Linee:</b> i tempi sono letture dei contatori, espressi in ore e minuti. Nel riepilogo compare l'intervallo minimo-massimo; non equivale automaticamente al lavoro svolto nella giornata.</li>
        <li><b>Terra e cassoni:</b> tonnellate e frequenze in Hz mostrano le letture disponibili. Non sommare le letture per ricavare la produzione e non dedurre fermi dai soli intervalli tra salvataggi.</li>
        <li><b>Completezza:</b> vengono caricati al massimo 500 record; una giornata può essere parziale. Gli zeri sono valori validi, mentre il trattino indica un dato mancante.</li>
    </ul>

    <h2>5. Gestione Servizio e Diagnostica</h2>

    <h3>Carico delle richieste e monitor reparto</h3>
    <p>Aprire <a href="paginaRichieste.html">Richieste e log</a> dagli Strumenti del pannello. La vista iniziale Riepilogo mostra richieste, dati inviati ed errori nel periodo del grafico, il trend e i tre computer con piu carico per il valore scelto. La scheda Log apre tabelle, filtri, totali dall'avvio e dettagli SQL, senza nuove chiamate al server. Si puo aprire direttamente con <a href="paginaRichieste.html#log">Richieste e log - Log</a>. Le ultime 500 richieste concluse sono accorpate in una riga per IP, con numero di chiamate, ultimo contatto, reparti, errori HTTP, interruzioni, durata media e massima e byte totali delle risposte. Espandere Percorsi per vedere il conteggio delle chiamate a ciascun percorso del computer. La vista mostra 25 IP per pagina. Ricerca e filtri selezionano i computer con errori, interruzioni, chiamate di almeno un secondo o singole risposte di almeno 1 MiB, mantenendo il riepilogo completo delle loro richieste nel log disponibile. I log restano in memoria e si azzerano al riavvio; non vengono recuperate richieste precedenti all'attivazione.</p>
    <p>Per ciascun percorso sono indicati numero di richieste, byte del corpo delle risposte, durata media e massima, errori, interruzioni e risposte 304. I percorsi sono ordinati per la metrica scelta nel trend e comprendono anche i download degli installer. I byte escludono header e overhead TCP/TLS; non rappresentano il traffico complessivo della rete aziendale. La diagnostica segue le regole di accesso delle altre API gestionali e non registra query string, credenziali o contenuto delle richieste. I dati JSON restano disponibili su <a href="/api/diagnostica/rete" target="_blank" rel="noopener">GET /api/diagnostica/rete</a>.</p>
    <p>Il trend conserva fino a 30 intervalli di un minuto sul server, indipendentemente dal limite dei 500 log. Conta le richieste al completamento della risposta e comprende tutti i PC; i minuti senza traffico dopo l'avvio valgono zero. Il primo minuto osservato e quello corrente possono essere parziali. Il selettore Mostra permette di scegliere numero di richieste, traffico delle risposte, tempo medio o errori HTTP; e sincronizzato con Ordina per nella scheda Log e aggiorna grafico, riepilogo dei computer e ordinamento delle tabelle senza chiamate aggiuntive. Selezionare una barra per leggere il valore del minuto. Il riepilogo mostra i primi tre IP come righe con nome e valore; i percorsi sono nella tabella dei Log, senza una seconda classifica duplicata. I massimi nelle tabelle usano solo colore e peso del testo. Gli IP riguardano le ultime 500 richieste, i percorsi tutto il periodo dall'avvio. La raccolta del trend si attiva dopo il riavvio del servizio e si azzera a ogni riavvio; i minuti precedenti all'avvio non vengono ricostruiti.</p>
    <p>L'aggiornamento della pagina avviene ogni 15 secondi dal completamento della chiamata ed e sospeso quando la scheda e nascosta. Il checkbox permette di fermarlo per leggere i log. Dopo il primo caricamento vengono scaricate soltanto le righe nuove; il server ripristina il log completo disponibile quando il cursore e troppo vecchio o cambia l'avvio del servizio. Queste chiamate di controllo non entrano nei contatori o nel log. Anche elenco e report dei PC sospendono il polling nelle schede nascoste; il report scarica solo lo storico richiesto, senza rileggere l'elenco corrente.</p>
    <p>Per modificare gli script, partire dalle impostazioni in testa a <code>public/js/richieste.js</code>: intervallo di aggiornamento, timeout, limite dei log e soglie. Il flusso principale e <code>caricaRichieste</code>, poi <code>aggiornaRichiesteSalvate</code>, infine <code>aggiornaVistaAperta</code>. Il riepilogo per IP si ricalcola soltanto quando cambiano i log; le tabelle nascoste si costruiscono quando vengono aperte. Le funzioni di visualizzazione non fanno chiamate al server. In <code>services/statoReparto.js</code>, <code>leggi</code> decide se usare la cache, aspettare una lettura gia in corso o chiamare <code>aggiornaReparto</code>. Nel middleware della diagnostica, durata e byte aggiornano separatamente percorsi, minuti del trend e log; i limiti di memoria sono dichiarati in testa al file.</p>
    <p>La sezione <code>monitorReparti</code> distingue letture SQL, risposte dalla cache e richieste contemporanee accorpate, con errori e tempi SQL. Il server condivide una lettura per reparto per 15 secondi; se SQL fallisce, condivide l'errore per lo stesso intervallo senza indicare come aggiornati i dati precedenti. Ogni monitor visibile controlla i dati ogni 15 secondi dal completamento della richiesta e conserva la tabella in memoria: con ETag invariato riceve una risposta 304 senza corpo. La cache e il polling possono aggiungere complessivamente circa 30 secondi alla visibilita di una modifica, oltre al tempo SQL.</p>
    <p>I monitor nascosti sospendono i controlli e aggiornano i dati quando tornano visibili. Dopo errori consecutivi, i tentativi avvengono ogni 30, 60 e poi 120 secondi; al recupero tornano a 15 secondi. L'orario mostrato indica l'ultima lettura SQL riuscita. Per applicare le modifiche al backend occorre riavviare il servizio; ricaricare i monitor per aggiornare il codice del browser. I contatori sono in memoria e si azzerano al riavvio.</p>

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
    <p>I messaggi di errore dei monitor reparto, dei PC connessi e dei salvataggi sono rossi. Nessun dato disponibile e nessuna lavorazione sono stati vuoti, non guasti. In caso di aggiornamento fallito, i dati precedenti restano visibili e viene segnalata la loro mancata attualità. Dopo un caricamento riuscito lo stato di errore viene rimosso.</p>
    <p>Nei monitor reparto e nei PC connessi, aprire <b>Dettagli tecnici</b> per leggere l'errore originale (raw error), quando disponibile. Il dettaglio viene mostrato come testo, senza interpretare HTML; non è la descrizione operativa per l'utente. Per l'assistenza riportare pagina, reparto, orario, messaggio principale e dettaglio tecnico. Per altri endpoint consultare anche i log del servizio.</p>
    <ul>
        <li><b>401 - Accesso richiesto:</b> credenziali errate o sessione assente/scaduta. Ripetere il login. Dopo un riavvio del servizio è necessario accedere nuovamente.</li>
        <li><b>400 - Presenza non valida:</b> pagina o identificativo reparto inviati dal browser non hanno un formato valido. Ricaricare la pagina e verificare il parametro reparto.</li>
        <li><b>500 - Registro PC non disponibile:</b> verificare che <code>config/pcConnessi.json</code> sia un array JSON valido e che il servizio possa leggere e scrivere nella cartella config. Conservare una copia del registro prima di correggerlo.</li>
        <li><b>Timeout del monitor o dei PC:</b> dopo 10 secondi la richiesta viene interrotta. Il monitor riprova 5 secondi dopo il completamento della richiesta; i PC vengono aggiornati ogni 15 secondi. Verificare rete e servizio; i dati precedenti restano visibili.</li>
    </ul>
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
