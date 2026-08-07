// Scritto da Cristian Ceni 08/07/26
// File per la gestione del pool di connessioni al database

// Importo il modulo mssql
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
}

// Creo un pool di connessioni al database, faccio in modo che crei una sola connesione e la riutlizzi
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

module.exports = { getPool, sql };