// Scritto da Cristian Ceni 08/07/26
// Query da mandare al DB

const { getPool, sql } = require('./pool');
const { getReparto } = require('../config/reparti');

// Nome vista del DB
const TABELLA_BOLLE = "NVS_V_IT_BOLLE";

// Per prova sentendo Emanuele ho inserito il filtro su RAGGR_CODICE_REPARTO anziché su CODICE_REPARTO - da testare - rimesso l'originale
const QUERY_STATO_REPARTO = `
  SELECT 
    DESCR_MACCHINA AS IMPIANTO,
    CODICE_LOTTO AS LOTTO,
    CODICE_ARTICOLO AS ARTICOLO,
    DESCRIZIONE_ARTICOLO AS DESCRIZIONE,
    DESCR_STATO_BOLLA AS STATO,
    ULTIMO_OPERATORE AS [CODICE OP],
    ULTIMO_OPERATORE_DESCR AS OPERATORE,
    QTA_AVANZATA AS [QTA TOT],
    QTA_AVANZ_GIORNALIERO AS [QTA GG],
    QTA_ORDINATA AS [QTA ORD]
  FROM ${TABELLA_BOLLE}
  WHERE CAST(DATA_AVANZ_GIORNALIERO AS DATE) >= CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
    AND CODICE_STATO_BOLLA IN (0, 1, 2, 3, 4)
    AND RAGGR_CODICE_REPARTO = @codiceReparto
  ORDER BY DATA_AVANZ_GIORNALIERO DESC
`;

// Funzione che lancia la query filtrata per reparto e ne ritorna i risultati
async function eseguiQueryReparto(idReparto) {
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

module.exports = { eseguiQueryReparto };
