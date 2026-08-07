const { parseEtichetteStampante } = require('./parseEtichetta');

function testoDb(valore) {
  if (valore === null || valore === undefined) return null;
  return String(valore).trim();
}

function flagDb(valore, valoreVero) {
  return String(valore || '').trim().toUpperCase() === valoreVero;
}

function numeroDb(valore) {
  if (valore === null || valore === undefined || valore === '') return null;
  const numero = Number(valore);
  return Number.isFinite(numero) ? numero : null;
}

// Converte il record TeamSystem nell'unico formato usato dall'applicazione.
// La route JSON e la composizione ZPL devono passare entrambe da qui.
function normalizzaArticolo(riga) {
  if (!riga) return null;

  const etichette = parseEtichetteStampante(riga.ETICHETTE);

  return {
    codice: testoDb(riga.ARTICOLO) || '',
    descrizione: testoDb(riga.DESCRIZIONE),
    categoria: testoDb(riga.CATEGORIA),
    dop: testoDb(riga.DOP),
    enteCertificatore: testoDb(riga.ENTE),
    numeroMarcaturaCE: testoDb(riga.MARCATURA),
    pesoGrammi: riga.PESO,
    pezziPerPacco: riga.PEZZIPACCO,
    descrizioneAggiuntiva: testoDb(riga.DESCR_AGGIUNTIVE),
    stampaLotto: flagDb(riga.STLOTTO, 'S'),
    stampaUnitaMisuraSecondaria: flagDb(riga.UM_ETICHETTA, 'SI'),
    fattoreConv: numeroDb(riga.FATTORE_CONVERSIONE),
    caratteristicheTecniche: etichette.caratteristiche,
    norma: etichette.norma,
    campiZpl: etichette.campiZpl,
    um1: testoDb(riga.UM1),
    um2: testoDb(riga.UM2)
  };
}

module.exports = { normalizzaArticolo };
