// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: caricare i reparti e gestire il dialog delle impostazioni.

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

caricaImpostazioni();
caricaIndice();
