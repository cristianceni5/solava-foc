// Scritto da Claude e Cristian Ceni 10/07/26
// Funzione per compilare i campi placeholder dell'etichetta

function componiZPL(templateZpl, dati) {
  let zpl = templateZpl;
  for (const [chiave, valore] of Object.entries(dati)) {
    const token = `{${chiave}}`;
    zpl = zpl.split(token).join(valore != null ? String(valore) : '');
  }
  zpl = zpl.replace(/\{[A-Z0-9_]+\}/g, '');
  return zpl;
}

// Composizione del progressivo per l'etichetta: solo timestamp di stampa
// (matricola dipendente e numero pacco rimossi su decisione esplicita, non più tracciati qui)
function componiTimestamp(data = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const giorno = pad(data.getDate());
  const mese = pad(data.getMonth() + 1);
  const anno = String(data.getFullYear()).slice(2);
  const ore = pad(data.getHours());
  const minuti = pad(data.getMinutes());
  const secondi = pad(data.getSeconds());
  return `${giorno}${mese}${anno}${ore}${minuti}${secondi}`; // GGMMAAHHmmss
}

// Funzione per estrarre l'etichetta reale da un template ZPL che può contenere più blocchi ^XA...^XZ DIOCANE
function estraiEtichettaReale(zplGrezzo) {
  const blocchi = [...zplGrezzo.matchAll(/\^XA([\s\S]*?)\^XZ/g)].map(m => m[1]);
  if (blocchi.length <= 1) return zplGrezzo;
  return '^XA' + blocchi.join('') + '^XZ'; // un solo blocco, tutti i comandi in ordine
}

// Rimuove il logo CE (grafica ^GFA) quando il toggle "mostra CE" è spento.
// Coordinate verificate sul template attivo CAM_redesign_prova600.prn: il logo CE
// è la grafica in ^FO128,256. Il blocco ^GFA non termina con ^FS ma con un
// checksum a 4 cifre esadecimali dopo i due punti (es. ":3993"), quindi il regex
// si ferma lì e non sulla prima ^FS successiva (che altrimenti si porterebbe via
// anche i campi dopo, tipo CAMPO_1).
function rimuoviLogoCE(zpl) {
  return zpl.replace(/\^FO128,256\^GFA,[\s\S]*?:[0-9A-Fa-f]{4}\r?\n/, '');
}

// Rimuove il logo ICMQ (grafica in ^FO800,256) e il testo fisso associato
// ("P891" / "CP DOC 262 rev. 2.2" in ^FT862,504 e ^FT862,538) quando il toggle
// "mostra ICMQ" è spento.
function rimuoviLogoICMQ(zpl) {
  return zpl
    .replace(/\^FO800,256\^GFA,[\s\S]*?:[0-9A-Fa-f]{4}\r?\n/, '')
    .replace(/\^FT862,504[\s\S]*?\^FS/, '')
    .replace(/\^FT862,538[\s\S]*?\^FS/, '');
}

module.exports = { componiZPL, componiTimestamp, estraiEtichettaReale, rimuoviLogoCE, rimuoviLogoICMQ };