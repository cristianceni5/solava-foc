/*
 * Componente indipendente dalle API e dalle singole pagine.
 * creaReportTabella({ contenitore, colonne: [{ chiave, etichetta, formatta? }],
 *   chiave: record => record.id, etichetta: record => record.nome,
 *   riepilogo?: records => [{ etichetta, valore }] })
 * Il chiamante passa i dati con aggiorna(records); nessuna richiesta HTTP interna.
 */
function creaReportTabella(opzioni) {
    const { contenitore } = opzioni;
    const testata = document.createElement('div');
    testata.className = opzioni.toolbar ? 'report-toolbar' : 'report-tabella-testata';
    const titolo = document.createElement('h2');
    const selettoreLabel = document.createElement('label');
    selettoreLabel.className = 'report-tabella-selettore';
    const testoLabel = document.createElement('span');
    testoLabel.textContent = opzioni.etichettaSelettore || 'Visualizza';
    const selettore = document.createElement('select');
    selettoreLabel.append(testoLabel, selettore);
    const navigazione = opzioni.selettoreOrizzontale ? document.createElement('div') : selettoreLabel;
    if (opzioni.selettoreOrizzontale) {
        navigazione.className = 'report-eventi';
        navigazione.setAttribute('role', 'group');
        navigazione.setAttribute('aria-label', 'Riepilogo e dettaglio computer');
    }
    testata.append(titolo, opzioni.toolbar || navigazione);
    const griglia = document.createElement('dl');
    griglia.className = 'report-tabella-griglia';
    const vuoto = document.createElement('p');
    vuoto.className = 'report-tabella-vuoto';
    vuoto.textContent = opzioni.messaggioVuoto || 'Nessun dato disponibile per il report.';
    contenitore.classList.add('report-tabella');
    if (opzioni.layout === 'dashboard') contenitore.classList.add('report-tabella--dashboard');
    if (opzioni.toolbar) {
        selettoreLabel.className += ' report-tabella-selettore--navigazione';
        contenitore.replaceChildren(testata, navigazione, vuoto, griglia);
    } else contenitore.replaceChildren(testata, vuoto, griglia);
    let records = [];
    let selezione = '';
    let firmaOpzioni = '';
    const selettoreOrizzontale = opzioni.selettoreOrizzontale ? creaSelettoreReport(navigazione, chiave => {
        selezione = chiave;
        mostra();
        aggiornaNavigazione();
    }) : null;
    function aggiornaNavigazione() {
        if (selettoreOrizzontale) selettoreOrizzontale.aggiorna([
            { chiave: '', etichetta: `Riepilogo - ${records.length}` },
            ...records.map((record, indice) => ({ chiave: `record:${chiave(record, indice)}`, etichetta: etichetta(record, indice) }))
        ], selezione);
    }
    const chiave = opzioni.chiave || ((record, indice) => indice);
    const etichetta = opzioni.etichetta || ((record, indice) => `Record ${indice + 1}`);
    const valoreTesto = valore => valore === null || valore === undefined || valore === '' ? '—'
        : typeof valore === 'object' ? JSON.stringify(valore) : String(valore);

    function mostra() {
        const indice = records.findIndex((record, i) => `record:${chiave(record, i)}` === selezione);
        const record = indice >= 0 ? records[indice] : null;
        griglia.className = 'report-tabella-griglia' + (record ? ' report-tabella-griglia--dettaglio' : '');
        titolo.textContent = record && !opzioni.titoloFisso ? etichetta(record, indice) : (opzioni.titolo || 'Riepilogo');
        vuoto.hidden = records.length > 0;
        griglia.hidden = records.length === 0;
        const colonne = opzioni.colonne || [...new Set(records.flatMap(voce => Object.keys(voce)))].map(nome => ({ chiave: nome, etichetta: nome }));
        const campi = record ? colonne.filter(colonna => !colonna.nascondiDettaglio).map(colonna => ({
            etichetta: colonna.etichetta || colonna.chiave,
            ampio: colonna.ampio,
            tipo: colonna.tipo,
            voci: colonna.voci ? colonna.voci(record[colonna.chiave], record) : undefined,
            valore: colonna.formatta ? colonna.formatta(record[colonna.chiave], record) : record[colonna.chiave]
        })) : opzioni.riepilogo ? opzioni.riepilogo(records) : [{ etichetta: 'Record registrati', valore: records.length }];
        griglia.replaceChildren(...campi.map(campo => {
            const blocco = document.createElement('div');
            blocco.className = 'report-tabella-campo';
            if (campo.ampio) blocco.className += ' report-tabella-campo--ampio';
            if (campo.tipo === 'metrica') blocco.className += ' report-tabella-campo--metrica';
            if (campo.tipo === 'identita') blocco.className += ' report-tabella-campo--identita';
            if (Array.isArray(campo.voci)) blocco.className += ' report-tabella-campo--distribuzione';
            const nome = document.createElement('dt');
            nome.textContent = campo.etichetta;
            const valore = document.createElement('dd');
            valore.textContent = valoreTesto(campo.valore);
            if (Array.isArray(campo.voci)) {
                valore.textContent = '';
                const lista = document.createElement('ol');
                lista.className = 'report-distribuzione';
                const totale = campo.voci.reduce((somma, voce) => somma + voce.valore, 0);
                const ciambella = opzioni.graficoDistribuzione === 'ciambella' && totale > 0;
                const colori = ['#9e4438', '#327b82', '#bd8a2e', '#716299', '#477455', '#b35c80', '#536881', '#8a724d'];
                const settori = [];
                let cumulata = 0;
                let indiceVoce = 0;
                for (const voce of campo.voci) {
                    const riga = document.createElement('li');
                    if (ciambella) {
                        const colore = colori[indiceVoce++ % colori.length];
                        const fine = cumulata + voce.valore / totale * 100;
                        settori.push(`${colore} ${cumulata}% ${fine}%`);
                        cumulata = fine;
                        riga.setAttribute('style', `--colore-voce: ${colore}`);
                    }
                    const etichetta = document.createElement('span');
                    etichetta.className = 'report-distribuzione-nome';
                    etichetta.textContent = voce.etichetta;
                    const numero = document.createElement('span');
                    numero.className = 'report-distribuzione-numero';
                    const quota = totale ? Math.round(voce.valore / totale * 100) : 0;
                    numero.textContent = `${voce.valore} ${voce.valore === 1 ? 'rilevazione' : 'rilevazioni'} · ${quota}%`;
                    const barra = document.createElement('progress');
                    barra.max = totale || 1;
                    barra.value = voce.valore;
                    barra.setAttribute('aria-label', `${voce.etichetta}: ${quota}% delle rilevazioni`);
                    riga.append(etichetta, numero);
                    if (!ciambella) riga.append(barra);
                    lista.append(riga);
                }
                if (ciambella) {
                    valore.className = 'report-grafico-distribuzione';
                    lista.className += ' report-distribuzione--legenda';
                    const grafico = document.createElement('div');
                    grafico.className = 'report-ciambella';
                    grafico.setAttribute('style', `background: conic-gradient(${settori.join(', ')});`);
                    grafico.setAttribute('aria-hidden', 'true');
                    const centro = document.createElement('span');
                    const numeroTotale = document.createElement('strong');
                    numeroTotale.textContent = totale.toLocaleString('it-IT');
                    const didascalia = document.createElement('small');
                    didascalia.textContent = totale === 1 ? 'rilevazione' : 'rilevazioni';
                    centro.append(numeroTotale, didascalia);
                    grafico.append(centro);
                    valore.append(grafico);
                }
                valore.append(lista);
            }
            if (campo.descrizione) {
                const nota = document.createElement('p');
                nota.className = 'report-tabella-nota';
                nota.textContent = campo.descrizione;
                valore.append(nota);
            }
            blocco.append(nome, valore);
            return blocco;
        }));
    }
    selettore.addEventListener('change', () => { selezione = selettore.value; mostra(); });

    function aggiorna(dati) {
        if (!Array.isArray(dati)) throw new TypeError('Il report richiede un array di record');
        records = dati;
        const voci = records.map((record, indice) => ({ valore: `record:${chiave(record, indice)}`, testo: etichetta(record, indice) }));
        if (!voci.some(voce => voce.valore === selezione)) selezione = '';
        // Non ricrea il selettore ad ogni polling: mantiene il focus da tastiera.
        const firma = JSON.stringify(voci);
        if (firma !== firmaOpzioni) {
            const generale = document.createElement('option');
            generale.value = '';
            generale.textContent = opzioni.titolo || 'Riepilogo';
            selettore.replaceChildren(generale, ...voci.map(voce => {
                const option = document.createElement('option');
                option.value = voce.valore;
                option.textContent = voce.testo;
                return option;
            }));
            firmaOpzioni = firma;
        }
        selettore.value = selezione;
        selettore.disabled = records.length === 0;
        aggiornaNavigazione();
        mostra();
    }
    aggiorna([]);
    return { aggiorna };
}
