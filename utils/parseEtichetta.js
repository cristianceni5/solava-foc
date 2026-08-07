// Scritto da Claude e Cristian Ceni 09/07/26
// Funzione per parsare le etichette stampante

function parseEtichetteStampante(raw) {
  if (!raw) return { caratteristiche: [], norma: null, campiZpl: {} };

  // TeamSystem salva due tracciati diversi nella stessa colonna:
  // - uni771: tipo + classificazione + slot tecnici + norma
  // - nocesolava: tipo + 20 righe testuali, senza classificazione e norma
  // Le righe vuote sono slot reali: eliminarle sposta tutti i campi successivi.
  const righe = String(raw).replace(/\r/g, '').split('\n');
  const tipoEtichetta = (righe[0] || '').trim().toLowerCase();
  const senzaCe = tipoEtichetta === 'nocesolava';
  // Solo questi tracciati hanno una riga di classificazione prima degli
  // attributi. uni14411, uni1344, uni1304 e siceung partono subito da AV1.
  const conClassificazione = ['uni771', 'ukuni771', 'siceung2'].includes(tipoEtichetta);

  const classificazione = conClassificazione ? (righe[1] || '').trim() : null;
  const indiceNorma = senzaCe
    ? -1
    : righe.findLastIndex(riga => String(riga || '').trim().length > 0);
  const corpo = conClassificazione
    ? righe.slice(2, indiceNorma)
    : righe.slice(1, senzaCe ? 21 : indiceNorma);
  const norma = senzaCe || indiceNorma < 2 ? null : righe[indiceNorma].trim();

  const gruppi = ['AV', 'AV', 'AV', 'AV', 'BV', 'BV', 'BV', 'BV',
    'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV', 'CV'];

  const caratteristiche = [];
  const campiZpl = {};
  const contatori = {};

  if (classificazione) {
    caratteristiche.push({ etichetta: classificazione, valore: '' });
    campiZpl['CLASSIFICAZIONE'] = classificazione; // chiave nuova, additiva: se il .prn
  }

  corpo
    .forEach((riga, i) => {
      if (i >= gruppi.length) return;
      const prefisso = gruppi[i];
      contatori[prefisso] = (contatori[prefisso] || 0) + 1;
      const chiave = `${prefisso}${contatori[prefisso]}`;
      const colonne = String(riga || '').split('\t').map(c => c.trim());
      const etichetta = colonne[0] || '';
      const valore = colonne.slice(1).find(Boolean) || '';

      caratteristiche.push({ etichetta, valore });
      campiZpl[chiave] = etichetta;
      campiZpl[`${chiave}_R`] = valore;
    });

  if (norma) {
    // La norma ora è un attributo normale in fondo alla lista (richiesta esplicita),
    // non più un campo separato gestito solo dal frontend.
    caratteristiche.push({ etichetta: 'Norma di riferimento', valore: norma });
  }
  campiZpl['DV1'] = norma; // chiave storica invariata: se il template .prn la referenzia già
  // come {DV1}, non voglio romperlo rinominandola alla cieca, dopo si riguarda ehh

  return { caratteristiche, norma, campiZpl };
}

module.exports = { parseEtichetteStampante };
