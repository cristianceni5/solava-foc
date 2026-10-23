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
                signal: AbortSignal.timeout(10000)
            });
            if (risposta.ok) window.dispatchEvent(new Event('fop-presenza'));
        } catch { /* Il prossimo segnale ritenta senza interrompere la pagina. */ }
        finally { inCorso = false; }
    }
    presenza();
    window.setInterval(presenza, 30000);
    window.addEventListener('pageshow', evento => { if (evento.persisted) presenza(); });
})();
