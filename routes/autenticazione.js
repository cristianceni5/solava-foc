// Accesso con utenti locali e sessioni in memoria, valide per otto ore.
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, timingSafeEqual, createHash } = require('node:crypto');
const router = express.Router();
const sessioni = new Map();
const DURATA = 8 * 60 * 60 * 1000;
const COOKIE = 'fop_sessione';

function tokenRichiesta(req) {
  const cookie = (req.headers.cookie || '').split(';').find(voce => voce.trim().startsWith(`${COOKIE}=`));
  return cookie ? cookie.trim().slice(COOKIE.length + 1) : '';
}

function opzioniCookie(req) {
  return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' };
}

function passwordUguale(inserita, prevista) {
  const hash = valore => createHash('sha256').update(valore).digest();
  return timingSafeEqual(hash(inserita), hash(prevista));
}

function leggiSessione(req) {
  const token = tokenRichiesta(req);
  const sessione = sessioni.get(token);
  if (!sessione || sessione.scadenza <= Date.now()) {
    sessioni.delete(token);
    return null;
  }
  return sessione;
}

router.use('/api/autenticazione', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/api/autenticazione', async (req, res) => {
  const { utente, password } = req.body || {};
  if (typeof utente !== 'string' || !utente.trim() || utente.length > 100
      || typeof password !== 'string' || !password || password.length > 1024) {
    return res.status(400).json({ errore: 'Inserisci nome utente e password validi' });
  }
  try {
    const contenuto = await fs.readFile(path.join(__dirname, '../config/utenti.json'), 'utf8');
    const utenti = JSON.parse(contenuto.replace(/^\uFEFF/, ''));
    if (!Array.isArray(utenti) || utenti.some(voce => !voce || typeof voce.utente !== 'string' || typeof voce.password !== 'string')) {
      throw new Error('Formato del file utenti non valido');
    }
    const trovato = utenti.find(voce => voce.utente === utente.trim());
    if (!trovato || !passwordUguale(password, trovato.password)) {
      return res.status(401).json({ errore: 'Nome utente o password non corretti' });
    }
    const ora = Date.now();
    for (const [token, sessione] of sessioni) {
      if (sessione.scadenza <= ora) sessioni.delete(token);
    }
    sessioni.delete(tokenRichiesta(req));
    const token = randomBytes(32).toString('hex');
    sessioni.set(token, { utente: trovato.utente, scadenza: ora + DURATA });
    res.cookie(COOKIE, token, { ...opzioniCookie(req), maxAge: DURATA });
    return res.json({ utente: trovato.utente });
  } catch (error) {
    console.error('Errore lettura file utenti:', error.message);
    return res.status(500).json({ errore: 'Accesso temporaneamente non disponibile' });
  }
});

router.get('/api/autenticazione', (req, res) => {
  const sessione = leggiSessione(req);
  if (!sessione) return res.status(401).json({ errore: 'Accesso richiesto' });
  return res.json({ utente: sessione.utente });
});

router.post('/api/autenticazione/logout', (req, res) => {
  sessioni.delete(tokenRichiesta(req));
  res.clearCookie(COOKIE, opzioniCookie(req));
  res.sendStatus(204);
});

module.exports = router;
module.exports.leggiSessione = leggiSessione;
