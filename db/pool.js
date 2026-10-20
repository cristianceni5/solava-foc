// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: condividere il pool SQL e consentire nuovi tentativi dopo un collegamento fallito.

const sql = require('mssql');

// Configurazione della connessione al database, credenziali da dotenv
const config = {
  server: process.env.DB_IP, 
  database: process.env.DB_NOME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true, // Nel caso SQL-Server queste 2 vanno messe a true
    trustServerCertificate: true
  }
};

// Le richieste concorrenti condividono lo stesso tentativo di connessione.
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch(err => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
