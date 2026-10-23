const formAccesso = document.getElementById('formAccesso');
const pulsanteAccesso = document.getElementById('btnCerca');
const erroreAccesso = document.getElementById('erroreAccesso');

formAccesso.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pulsanteAccesso.disabled) return;
    erroreAccesso.textContent = '';
    pulsanteAccesso.disabled = true;
    formAccesso.setAttribute('aria-busy', 'true');
    pulsanteAccesso.textContent = 'Accesso in corso…';
    try {
        const risposta = await fetch('/api/autenticazione', {
            method: 'POST',
            signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                utente: document.getElementById('inputNome').value.trim(),
                password: document.getElementById('inputPassword').value
            })
        });
        const dati = await risposta.json();
        if (!risposta.ok) {
            erroreAccesso.textContent = dati.errore || 'Accesso non riuscito';
            erroreAccesso.focus();
            return;
        }
        const destinazione = new URLSearchParams(window.location.search).get('ritorno');
        let url;
        try { url = new URL(destinazione || '/index.html', window.location.origin); }
        catch { url = new URL('/index.html', window.location.origin); }
        window.location.assign(url.origin === window.location.origin && url.pathname !== '/autenticazione.html'
            ? url.href : '/index.html');
    } catch {
        erroreAccesso.textContent = 'Impossibile contattare il server. Riprova.';
        erroreAccesso.focus();
    } finally {
        pulsanteAccesso.disabled = false;
        formAccesso.setAttribute('aria-busy', 'false');
        pulsanteAccesso.textContent = 'Accedi';
    }
});
