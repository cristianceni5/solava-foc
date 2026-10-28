// Autori: Cristian Ceni, Codex
// Ultima modifica: 26/10/2026
// Scopo: caricare i reparti e gestire il dialog delle impostazioni - aggiunto saluto e meteo.

const dialogImpostazioni = document.getElementById('dialog-impostazioni');
document.getElementById('apri-impostazioni').addEventListener('click', () => dialogImpostazioni.showModal());
document.getElementById('chiudi-impostazioni').addEventListener('click', () => dialogImpostazioni.close());
dialogImpostazioni.addEventListener('click', evento => {
    const area = dialogImpostazioni.getBoundingClientRect();
    if (evento.clientX < area.left || evento.clientX > area.right ||
        evento.clientY < area.top || evento.clientY > area.bottom) {
        dialogImpostazioni.close();
    }
});

function salutoDinamico()
{
    const saluto = document.getElementById('saluto-home');
    let testoSalutoDinamico;
    const data = Date.now();
    const oggi = new Date(data);
    const giorno = oggi.toUTCString();  
    const ora = oggi.getHours();

    let salutoOra;
    if(ora <= 12)
        salutoOra = 'Buongiorno';
    else if(ora > 12 && ora < 17)
        salutoOra = 'Buon pomeriggio';
    else if(ora >= 17 && ora <= 23)
        salutoOra = 'Buona sera'

    let giornoForm;
    if(giorno.includes('Fri'))
        giornoForm = ' e buon venerdì';
    else if (giorno.includes('Sat'))
        giornoForm = ' e buon sabato.';
    else if (giorno.includes('Sun'))
        giornoForm = ' e buona domenica.';
    else if (giorno.includes('Mon'))
        giornoForm = ' e buon lunedì.';
    else if (giorno.includes('Tue'))
        giornoForm = ' e buon martedì.';
    else if (giorno.includes('Wed'))
        giornoForm = ' e buon mercoledì';
    else if (giorno.includes('Thu'))
        giornoForm = ' e buon giovedì.';

    testoSalutoDinamico = salutoOra + giornoForm;

    console.log(testoSalutoDinamico);
    saluto.textContent = testoSalutoDinamico; 
}

function descriviMeteo(simbolo) {
    const notte = simbolo.endsWith('_night');
    const condizione = simbolo.split('_')[0];
    if (condizione.includes('thunder')) return ['fa-cloud-bolt', 'Temporale'];
    if (condizione.includes('sleet')) return ['fa-cloud-rain', 'Pioggia mista a neve'];
    if (condizione.includes('snow')) return ['fa-snowflake', 'Neve'];
    if (condizione.includes('rain')) return ['fa-cloud-showers-heavy', 'Pioggia'];
    if (condizione === 'fog') return ['fa-smog', 'Nebbia'];
    if (condizione === 'cloudy') return ['fa-cloud', 'Nuvoloso'];
    if (condizione === 'partlycloudy') return [notte ? 'fa-cloud-moon' : 'fa-cloud-sun', 'Parzialmente nuvoloso'];
    if (condizione === 'fair') return [notte ? 'fa-cloud-moon' : 'fa-cloud-sun', 'Poco nuvoloso'];
    if (condizione === 'clearsky') return [notte ? 'fa-moon' : 'fa-sun', 'Sereno'];
    return ['fa-temperature-half', 'Meteo'];
}

async function caricaMeteo() {
    const contenitore = document.getElementById('meteo-home');
    const testo = document.getElementById('meteo-testo');
    const icona = document.getElementById('meteo-icona');
    if (!contenitore || !testo || !icona) return;

    try {
        const risposta = await fetch('/api/meteo', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (!risposta.ok) throw new Error('Meteo non disponibile');
        const dati = await risposta.json();
        if (!Number.isFinite(dati.temperatura) || typeof dati.simbolo !== 'string'
            || !Number.isFinite(Date.parse(dati.orario))) throw new Error('Dati meteo non validi');
        const [classe, descrizione] = descriviMeteo(dati.simbolo);
        const temperatura = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(dati.temperatura);
        icona.className = `fa-solid ${classe}`;
        testo.textContent = `${temperatura} °C - ${descrizione} - ${dati.localita   }`;
        const orario = new Intl.DateTimeFormat('it-IT', {
            timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit'
        }).format(new Date(dati.orario));
        contenitore.title = `Meteo previsto per le ${orario} · Dati MET Norway (CC BY 4.0), temperatura arrotondata`;
    } catch {
        icona.className = 'fa-solid fa-cloud';
        testo.textContent = 'Meteo non disponibile';
        contenitore.removeAttribute('title');
    }
}

async function caricaIndice() {
    const contenitore = document.getElementById('lista-reparti');
    const stato = document.getElementById('stato-reparti');
    stato.className = 'stato-caricamento';
    stato.textContent = 'Caricamento reparti...';
    contenitore.replaceChildren();
    try {
        const res = await fetch('/api/reparti', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error('Risposta non valida');
        const reparti = await res.json();
        for (const [id, info] of Object.entries(reparti)) {
            const link = document.createElement('a');
            link.href = `paginaReparto.html?reparto=${encodeURIComponent(id)}`;
            const icona = document.createElement('i');
            icona.className = 'fa-solid fa-industry';
            icona.setAttribute('aria-hidden', 'true');
            const nome = document.createElement('span');
            nome.textContent = info.nome;
            const freccia = document.createElement('i');
            freccia.className = 'fa-solid fa-arrow-right home-link-arrow';
            freccia.setAttribute('aria-hidden', 'true');
            link.append(icona, nome, freccia);
            contenitore.appendChild(link);
        }
        stato.textContent = '';
    } catch {
        stato.className = 'stato-caricamento errore';
        stato.innerHTML = 'Impossibile caricare i reparti. <button type="button" id="riprova-reparti">Riprova</button>';
        document.getElementById('riprova-reparti').addEventListener('click', caricaIndice);
    }
}

async function caricaImpostazioni() {
    const richiediAccesso = () => window.location.assign('/autenticazione.html?ritorno=' +
        encodeURIComponent(window.location.pathname + window.location.search + window.location.hash));
    const check = document.getElementById('check-auto');
    const auth = document.getElementById('check-auth');
    const minuti = document.getElementById('minuti-riapertura');
    const stato = document.getElementById('stato-impostazioni');
    try {
        const res = await fetch('/api/impostazioni', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (res.status === 401) { richiediAccesso(); return; }
        if (!res.ok) throw new Error('Impostazioni non disponibili');
        const risposta = await res.json();
        const config = Array.isArray(risposta) ? risposta[0] : risposta;
        check.checked = config.consensoAuto === true || config.consensoAuto === 'true';
        auth.checked = config.richiediAuth === true;
        minuti.value = config.minuti ?? 0;
        check.disabled = auth.disabled = minuti.disabled = false;
        stato.textContent = 'Le modifiche vengono salvate automaticamente.';
    } catch {
        stato.className = 'stato-impostazioni errore';
        stato.textContent = 'Impostazioni non disponibili. Ricarica la pagina per riprovare.';
        return;
    }

    let coda = Promise.resolve();
    let versione = 0;
    const salva = () => {
        if (!minuti.reportValidity()) return;
        const dati = { consensoAuto: check.checked, minuti: Number(minuti.value), richiediAuth: auth.checked };
        const corrente = ++versione;
        stato.className = 'stato-impostazioni';
        stato.textContent = 'Salvataggio in corso...';
        // Mantiene l'ordine delle modifiche anche quando l'operatore cambia piu' campi.
        coda = coda.then(async () => {
            const res = await fetch('/api/set-automazione', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati),
                signal: AbortSignal.timeout(10000)
            });
            if (res.status === 401) { richiediAccesso(); return; }
            if (!res.ok) {
                const risposta = await res.json();
                throw new Error(risposta.errore || 'Salvataggio non riuscito');
            }
            if (corrente === versione) stato.textContent = 'Impostazioni salvate.';
            if (dati.richiediAuth) {
                try {
                    const sessione = await fetch('/api/autenticazione', { signal: AbortSignal.timeout(10000) });
                    if (sessione.status === 401) richiediAccesso();
                } catch {
                    if (corrente === versione) stato.textContent = 'Impostazioni salvate. Verifica della sessione non disponibile: ricarica la pagina.';
                }
            }
        }).catch(err => {
            if (corrente === versione) {
                stato.className = 'stato-impostazioni errore';
                stato.textContent = `${err.message}. Modifica nuovamente un campo per riprovare.`;
            }
        });
    };
    check.addEventListener('change', salva);
    auth.addEventListener('change', salva);
    minuti.addEventListener('change', salva);
}

salutoDinamico();
caricaMeteo();
window.setInterval(() => {
    if (!document.hidden) {
        salutoDinamico();
        caricaMeteo();
    }
}, 15 * 60 * 1000);
caricaImpostazioni();
caricaIndice();
