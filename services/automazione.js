// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: validare e salvare le impostazioni con aggiornamenti serializzati e scrittura atomica.

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const configPath = path.join(__dirname, '../config/settaggi.json');
let codaAggiornamenti = Promise.resolve();

function erroreValidazione(messaggio) {
  const errore = new Error(messaggio);
  errore.status = 400;
  return errore;
}

function validaModifiche(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw erroreValidazione('Impostazioni mancanti o non valide');
  }

  const modifiche = {};
  if (input.richiediAuth !== undefined) {
    if (typeof input.richiediAuth !== 'boolean') {
      throw erroreValidazione('La richiesta di accesso deve essere true o false');
    }
    modifiche.richiediAuth = input.richiediAuth;
  }
  if (input.consensoAuto !== undefined) {
    if (![true, false, 'true', 'false'].includes(input.consensoAuto)) {
      throw erroreValidazione('Il consenso deve essere true o false');
    }
    modifiche.consensoAuto = input.consensoAuto === true || input.consensoAuto === 'true';
  }
  if (input.minuti !== undefined) {
    const valore = input.minuti;
    const formatoValido = typeof valore === 'number'
      || (typeof valore === 'string' && /^\d+$/.test(valore.trim()));
    const minuti = Number(valore);
    if (!formatoValido || !Number.isSafeInteger(minuti) || minuti < 0) {
      throw erroreValidazione('I minuti devono essere un intero maggiore o uguale a zero');
    }
    modifiche.minuti = minuti;
  }
  return modifiche;
}

async function leggiConfigFile() {
  try {
    const config = JSON.parse((await fs.readFile(configPath, 'utf8')).replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Il file settaggi.json deve contenere un oggetto JSON');
    }
    return config;
  } catch (err) {
    if (err.code === 'ENOENT') return { consensoAuto: false, minuti: 0 };
    throw err;
  }
}

async function leggiConfig() {
  await codaAggiornamenti;
  return leggiConfigFile();
}

async function aggiornaConfig(input) {
  const modifiche = validaModifiche(input);
  const aggiornamento = codaAggiornamenti.then(async () => {
    const configAttuale = await leggiConfigFile();
    const nuovaConfig = { ...configAttuale, ...modifiche };
    const temporaneo = `${configPath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaneo, JSON.stringify(nuovaConfig, null, 2), { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporaneo, configPath);
    } finally {
      // Un errore di pulizia non deve nascondere l'errore originale di scrittura.
      await fs.unlink(temporaneo).catch(() => {});
    }
    return nuovaConfig;
  });

  // Una scrittura fallita non blocca gli aggiornamenti successivi.
  codaAggiornamenti = aggiornamento.catch(() => {});
  return aggiornamento;
}

module.exports = { leggiConfig, aggiornaConfig };
