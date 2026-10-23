const { leggiConfig } = require('../services/automazione');
const { leggiSessione } = require('../routes/autenticazione');

module.exports = function creaControlloAccesso(opzioni = {}) {
  const configurazione = opzioni.leggiConfig || leggiConfig;
  const sessione = opzioni.leggiSessione || leggiSessione;
  return async (req, res, next) => {
    // Normalizza anche i nomi codificati prima di applicare le regole.
    let percorso;
    try { percorso = decodeURIComponent(req.path).toLowerCase(); }
    catch { return res.sendStatus(400); }
    if (percorso.includes('\\') || percorso.split('/').includes('..') || percorso.includes('//')) return res.sendStatus(400);
    const api = percorso.startsWith('/api/');
    const risorsa = ['/css/', '/js/', '/assets/', '/vendor/'].some(prefisso => percorso.startsWith(prefisso));
    const pubblica = percorso === '/paginareparto.html' || percorso === '/autenticazione.html'
      || ['/api/stato', '/api/reparti', '/api/automazione', '/api/presenza'].includes(percorso);
    if (pubblica || (!api && risorsa)) return next();
    res.set('Cache-Control', 'no-store');
    try {
      const config = await configurazione();
      if (config.richiediAuth !== true || sessione(req)) return next();
      if (api) return res.status(401).json({ errore: 'Accesso richiesto' });
      return res.redirect('/autenticazione.html?ritorno=' + encodeURIComponent(req.originalUrl));
    } catch {
      return res.status(503).json({ errore: 'Impossibile verificare le impostazioni di accesso' });
    }
  };
};
