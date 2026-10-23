/* Calendario condiviso da tutti i report. */
function creaCalendarioReport(opzioni) {
    let giornoSelezionato = '', meseCalendario = '', record = [];
    const elemento = (tag, classe = '', testo = '') => { const el = document.createElement(tag); el.className = classe; el.textContent = testo; return el; };
    const dataGiorno = giorno => giorno === 'senza-data' ? 'Senza data' : giorno.split('-').reverse().join('/');
    const giornoRecord = riga => riga.giorno;
    const giorniDisponibili = () => record.map(r => r.giorno).sort().reverse();
    const scegliGiorno = giorno => { chiudiCalendario(true); opzioni.scegli(giorno); };
function chiudiCalendario(restituisciFocus = false) {
    document.getElementById('calendario-report').hidden = true;
    document.getElementById('apri-calendario').setAttribute('aria-expanded', 'false');
    if (restituisciFocus) document.getElementById('apri-calendario').focus();
}

function mostraCalendario() {
    const griglia = document.getElementById('calendario-giorni');
    griglia.replaceChildren();
    document.getElementById('calendario-mese').value = meseCalendario;
    const [anno, mese] = meseCalendario.split('-').map(Number);
    const primo = new Date(Date.UTC(anno, mese - 1, 1));
    const offset = (primo.getUTCDay() + 6) % 7;
    const totale = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
    const conteggi = new Map();
    record.forEach(riga => conteggi.set(riga.giorno, riga.numero));
    for (let i = 0; i < offset; i++) griglia.append(elemento('span', 'calendario-spazio'));
    for (let i = 1; i <= totale; i++) {
        const giorno = `${meseCalendario}-${String(i).padStart(2, '0')}`;
        const numero = conteggi.get(giorno) || 0;
        const pulsante = elemento('button', 'calendario-giorno');
        pulsante.type = 'button';
        pulsante.append(elemento('span', '', String(i)));
        if (numero) pulsante.append(elemento('small', '', String(numero)));
        pulsante.disabled = !numero;
        pulsante.setAttribute('aria-label', `${dataGiorno(giorno)}, ${numero} ${opzioni.unita || "rilevazioni"}`);
        pulsante.setAttribute('aria-pressed', String(giorno === giornoSelezionato));
        pulsante.addEventListener('click', () => scegliGiorno(giorno));
        griglia.append(pulsante);
    }
    document.getElementById('calendario-senza-data').hidden = !conteggi.has('senza-data');
}
for (const [id, delta] of [['report-precedente', 1], ['report-successivo', -1]]) {
    document.getElementById(id).addEventListener('click', () => {
        const giorni = giorniDisponibili();
        const giorno = giorni[giorni.indexOf(giornoSelezionato) + delta];
        if (giorno) scegliGiorno(giorno);
    });
}
document.getElementById('apri-calendario').addEventListener('click', () => {
    const calendario = document.getElementById('calendario-report');
    calendario.hidden = !calendario.hidden;
    document.getElementById('apri-calendario').setAttribute('aria-expanded', String(!calendario.hidden));
    if (!calendario.hidden) {
        mostraCalendario();
        document.getElementById('calendario-mese').focus();
    }
});
document.getElementById('calendario-mese').addEventListener('change', evento => {
    if (/^\d{4}-\d{2}$/.test(evento.target.value)) { meseCalendario = evento.target.value; mostraCalendario(); }
});
for (const [id, delta] of [['mese-precedente', -1], ['mese-successivo', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
        const [anno, mese] = meseCalendario.split('-').map(Number);
        const data = new Date(Date.UTC(anno, mese - 1 + delta, 1));
        meseCalendario = data.toISOString().slice(0, 7);
        mostraCalendario();
    });
}
document.getElementById('calendario-senza-data').addEventListener('click', () => scegliGiorno('senza-data'));
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('calendario-report').hidden) chiudiCalendario(true);
});
document.addEventListener('click', evento => {
    if (!evento.target.closest('.report-selezione')) chiudiCalendario();
});

    function aggiorna(giorno, conteggi) {
        if (giorno !== giornoSelezionato && giorno !== 'senza-data') meseCalendario = giorno.slice(0,7);
        giornoSelezionato = giorno;
        record = [...conteggi].map(([giorno, numero]) => ({ giorno, numero }));
        if (!meseCalendario) meseCalendario = giorniDisponibili().find(g => g !== 'senza-data')?.slice(0,7) || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date()).slice(0,7);
        const giorni = giorniDisponibili();
        const indice = giorni.indexOf(giorno);
        document.getElementById('report-data').textContent = dataGiorno(giorno);
        document.getElementById('report-precedente').disabled = indice < 0 || indice >= giorni.length - 1;
        document.getElementById('report-successivo').disabled = indice <= 0;
        mostraCalendario();
    }
    return { aggiorna, chiudi: chiudiCalendario };
}

function creaSelettoreReport(contenitore, scegli) {
    let firma = '';
    return { aggiorna(voci, selezionato) {
        const nuova = JSON.stringify([voci, selezionato]);
        if (nuova === firma) return;
        firma = nuova;
        const scroll = contenitore.scrollLeft;
        contenitore.replaceChildren();
        for (const voce of voci) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'report-evento'; button.textContent = voce.etichetta;
            button.setAttribute('aria-pressed', String(voce.chiave === selezionato));
            button.addEventListener('click', () => scegli(voce.chiave));
            contenitore.append(button);
        }
        contenitore.scrollLeft = scroll;
    } };
}
