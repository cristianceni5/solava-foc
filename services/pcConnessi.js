const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { REPARTI } = require('../config/reparti');

function creaRegistro(file = path.join(__dirname, '../config/pcConnessi.json'), orologio = () => new Date(), fileAlias = path.join(path.dirname(file), 'aliasPc.json')) {
  const avvio = orologio().getTime();
  let coda = Promise.resolve();
  async function leggiAlias() {
    try {
      const alias = JSON.parse((await fs.readFile(fileAlias, 'utf8')).replace(/^\uFEFF/, ''));
      if (!alias || typeof alias !== 'object' || Array.isArray(alias)
          || Object.values(alias).some(valore => typeof valore !== 'string')) {
        throw new Error('Alias PC non validi: usare un oggetto con IP e nomi testuali');
      }
      return alias;
    } catch (errore) {
      if (errore.code === 'ENOENT') return {};
      throw errore;
    }
  }
  function aliasPc(pc, alias) {
    return (Object.hasOwn(alias, pc.ip) ? alias[pc.ip] : typeof pc.alias === 'string' ? pc.alias : '').trim();
  }
  async function leggi() {
    try {
      const dati = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
      if (!Array.isArray(dati)) throw new Error('Registro PC non valido');
      if (dati.some(pc => !pc || typeof pc !== 'object' || Array.isArray(pc)
          || typeof pc.ip !== 'string' || !pc.ip
          || typeof pc.pagina !== 'string'
          || typeof pc.primoAccesso !== 'string' || !Number.isFinite(Date.parse(pc.primoAccesso))
          || typeof pc.ultimoContatto !== 'string' || !Number.isFinite(Date.parse(pc.ultimoContatto)))) {
        throw new Error('Registro PC non valido: controllare IP, pagina e date di ogni record');
      }
      // Elimina il vecchio campo DNS anche dai registri già salvati.
      return dati.map(({ nome, ...pc }) => pc);
    } catch (errore) {
      if (errore.code === 'ENOENT') return [];
      throw errore;
    }
  }
  function registra(ip, pagina, reparto = '') {
    const lavoro = coda.then(async () => {
      const elenco = await leggi();
      const ora = orologio().toISOString();
      let pc = elenco.find(voce => voce.ip === ip);
      if (!pc) { pc = { ip, alias: '', primoAccesso: ora }; elenco.push(pc); }
      const giorno = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(ora));
      const attivita = pc.attivita || {};
      const oggi = attivita[giorno] || { primoContatto: ora, ultimoContatto: ora, rilevazioni: 0, secondiOsservati: 0, usi: [] };
      const intervallo = (Date.parse(ora) - Date.parse(pc.ultimoContatto)) / 1000;
      const secondi = pc.ultimoContatto && pc.ultimoContatto >= oggi.primoContatto && intervallo >= 0 && intervallo <= 90 ? intervallo : 0;
      oggi.rilevazioni++;
      oggi.secondiOsservati += secondi;
      oggi.ultimoContatto = ora;
      let uso = oggi.usi.find(voce => voce.pagina === pagina && voce.reparto === reparto);
      if (!uso) { uso = { pagina, reparto, rilevazioni: 0 }; oggi.usi.push(uso); }
      uso.rilevazioni++;
      attivita[giorno] = oggi;
      // Conserva gli ultimi 90 giorni rilevati per ogni indirizzo.
      for (const vecchio of Object.keys(attivita).sort().slice(0, -90)) delete attivita[vecchio];
      pc.attivita = attivita;
      Object.assign(pc, { ultimoContatto: ora, pagina, reparto });
      const temporaneo = `${file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaneo, JSON.stringify(elenco, null, 2), { flag: 'wx' });
        await fs.rename(temporaneo, file);
      } finally {
        await fs.unlink(temporaneo).catch(() => {});
      }
    });
    coda = lavoro.catch(() => {});
    return lavoro;
  }
  async function elenco() {
    await coda;
    const alias = await leggiAlias();
    return (await leggi()).map(({ attivita, ...pc }) => ({ ...pc,
      alias: aliasPc(pc, alias),
      nomeReparto: Object.hasOwn(REPARTI, pc.reparto || '') ? REPARTI[pc.reparto].nome : '',
      connesso: Date.parse(pc.ultimoContatto) >= avvio && Date.now() - Date.parse(pc.ultimoContatto) < 90000
    })).sort((a, b) => b.ultimoContatto.localeCompare(a.ultimoContatto));
  }
  async function report(giornoRichiesto) {
    await coda;
    const alias = await leggiAlias();
    const pcs = await leggi();
    const giorni = [...new Set(pcs.flatMap(pc => Object.keys(pc.attivita || {})))].sort().reverse();
    const giorno = giornoRichiesto || giorni[0] || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
    const dati = pcs.filter(pc => pc.attivita?.[giorno]).map(pc => ({ ...pc.attivita[giorno], ip: pc.ip, alias: aliasPc(pc, alias),
      usi: pc.attivita[giorno].usi.map(uso => ({ ...uso, nomeReparto: Object.hasOwn(REPARTI, uso.reparto) ? REPARTI[uso.reparto].nome : uso.reparto }))
    }));
    const conteggi = Object.fromEntries(giorni.map(g => [g, pcs.filter(pc => pc.attivita?.[g]).length]));
    return { giorno, giorni, dati, conteggi };
  }
  return { registra, elenco, report };
}
module.exports = { creaRegistro, ...creaRegistro() };
