// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: manda una richiesta sulla presenza in certe pagine

const HANDSHAKE_RICHIESTA = 50000;
const ALLARME_RICHIESTA = 20000;

(() => {
    let inCorso = false;
    async function presenza() {
        if (inCorso) return;
        inCorso = true;
        try {
            const risposta = await fetch('/api/presenza', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pagina: window.location.pathname,
                    reparto: window.location.pathname.toLowerCase() === '/paginareparto.html'
                        ? new URLSearchParams(window.location.search).get('reparto') || '' : ''
                }),
                signal: AbortSignal.timeout(ALLARME_RICHIESTA)
            });
            if (risposta.ok) window.dispatchEvent(new Event('fop-presenza'));
        } catch { /* Il prossimo segnale ritenta senza interrompere la pagina. */ }
        finally { inCorso = false; }
    }
    presenza();
    window.setInterval(presenza, HANDSHAKE_RICHIESTA);
    window.addEventListener('pageshow', evento => { if (evento.persisted) presenza(); });
})();
