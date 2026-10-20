// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: interrogare i dati TeamSystem e i salvataggi di produzione nel database PLC.

const { getPool, sql } = require('./pool');
const { getReparto } = require('../config/reparti');
const { normalizzaArticolo } = require('../utils/normalizzaArticolo');

// Le tabelle NVS usano il database del pool, configurato tramite DB_NOME.
const TABELLA_BOLLE = "NVS_V_IT_BOLLE";
const TABELLA_ATTRIBUTI_ARTICOLI = 'NVS_T_ATTRIBUTI_ARTICOLI';

// Le tabelle SLV usano il database indicato da DB_NOME_PLC, sullo stesso server.
const DB_PLC = (process.env.DB_NOME_PLC || '').trim();
if (!DB_PLC) {
  throw new Error('Variabile di ambiente DB_NOME_PLC mancante o vuota');
}

// Le parentesi quadre delimitano il nome del database come identificatore SQL.
const TABELLA_SALVATAGGI_PRELAV = `[${DB_PLC.replaceAll(']', ']]')}].[dbo].[SLV_T_SALVATAGGI_PRELAV]`;

// Uso come raggruppamento il nuovo RAGGR_CODICE_REPARTO
const QUERY_STATO_REPARTO = `
  SELECT 
    DESCR_MACCHINA AS IMPIANTO,
    CODICE_LOTTO AS LOTTO,
    CODICE_ARTICOLO AS ARTICOLO,
    DESCRIZIONE_ARTICOLO AS DESCRIZIONE,
    DESCR_STATO_BOLLA_OPERATORE AS STATO,
    ULTIMO_OPERATORE AS [CODICE OP],
    ULTIMO_OPERATORE_DESCR AS OPERATORE,
    QTA_AVANZATA AS [QTA TOT],
    QTA_AVANZ_GIORNALIERO AS [QTA GG],
    QTA_AVANZ_GIORNALIERO_OPERATORE AS [QTA OP],
    QTA_ORDINATA AS [QTA ORD]
  FROM ${TABELLA_BOLLE}
  WHERE CAST(DATA_AVANZ_GIORNALIERO AS DATE) >= CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
    AND STATO_BOLLA_OPERATORE IN (0, 1, 2, 3, 4)
    AND RAGGR_CODICE_REPARTO = @codiceReparto
  ORDER BY DATA_AVANZ_GIORNALIERO DESC
`;

const QUERY_ARTICOLO_ETICHETTA = `
  SELECT
    ARTICOLO,
    DESCRIZIONE,
    PESO,
    PEZZIPACCO,
    ETICHETTE,
    DESCR_AGGIUNTIVE,
    CATEGORIA,
    ENTE,
    DOP,
    MARCATURA,
    STLOTTO,
    UM_ETICHETTA,
    UM1,
    UM2,
    PEZZIUM2,
    FATTORE_CONVERSIONE
  FROM ${TABELLA_ATTRIBUTI_ARTICOLI}

  WHERE LTRIM(RTRIM(ARTICOLO)) = @articolo
`;

// Query per estrarre tutti gli attributi di un articolo, filtrando per codice articolo. Restituisce un oggetto con i campi di TeamSystem pari pari.
const QUERY_ARTICOLO_ATTRIBUTI = `
  SELECT *
  FROM ${TABELLA_ATTRIBUTI_ARTICOLI}

  WHERE LTRIM(RTRIM(ARTICOLO)) = @articolo
`;

const QUERY_SALVATAGGI_PRELAV = `
  SELECT TOP (500) *
  FROM ${TABELLA_SALVATAGGI_PRELAV}
  ORDER BY DATA_ORA DESC`;

// QUERIES FUNZIONI STANDARD FOP

// Funzione che lancia la query filtrata per reparto e ne ritorna i risultati
async function getBolleReparto(idReparto) {
  const reparto = getReparto(idReparto);

  if (!reparto) {
    throw new Error(`Reparto sconosciuto: ${idReparto}`);
  }

  const pool = await getPool();
  const request = pool.request();
  request.input('codiceReparto', sql.VarChar(2), reparto.codiceReparto);

  const result = await request.query(QUERY_STATO_REPARTO);
  return result.recordset;
}

// Restituisce il modello articolo normalizzato, condiviso da API, anteprima e stampa.
async function getCercaArticoloEtichetta(codice) {
  const pool = await getPool();
  const risultato = await pool.request()
    .input('articolo', sql.VarChar, codice)
    .query(QUERY_ARTICOLO_ETICHETTA);

  return normalizzaArticolo(risultato.recordset[0]);
}

// Restituisce tutti gli attributi di un articolo, filtrando per codice articolo. Restituisce un oggetto con i campi di TeamSystem pari pari.
async function getCercaArticoloAttributi(codice) {
  const pool = await getPool();
  const risultato = await pool.request()
    .input('articolo', sql.VarChar, codice)
    .query(QUERY_ARTICOLO_ATTRIBUTI);

  return risultato.recordset[0]; // Restituisce l'oggetto con tutti gli attributi dell'articolo
}

// QUERIES PER SALVATAGGI PRODUZIONE

// PRELAVORAZIONE
// Restituisce gli ultimi 500 salvataggi, dal piu' recente al meno recente.
async function getSalvataggiPrelav() {
  const pool = await getPool();
  const risultato = await pool.request()
    .query(QUERY_SALVATAGGI_PRELAV);

  return risultato.recordset; // Restituisce l'array di salvataggi prelav
}

module.exports = { eseguiQueryReparto: getBolleReparto, cercaArticoloEtichetta: getCercaArticoloEtichetta, cercaArticoloAttributi: getCercaArticoloAttributi, getSalvataggiPrelav: getSalvataggiPrelav };

