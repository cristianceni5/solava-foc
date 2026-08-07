// Scritto da Cristian Ceni 22/07/26
// Porting dello script inline di index

// Funzione per caricare la lista dei reparti chiamando l'endpoint /api/reparti
async function caricaIndice() {
    const contenitore = document.getElementById('lista-reparti');
    const stato = document.getElementById('stato-reparti');
    stato.className = 'stato-caricamento';
    stato.textContent = 'Caricamento reparti...';
    contenitore.innerHTML = '';

    try {
        const res = await fetch('/api/reparti');
        if (!res.ok) throw new Error('Risposta non valida');
        const reparti = await res.json();

        for (const [id, info] of Object.entries(reparti)) {
            const link = document.createElement('a');
            link.href = `paginaReparto.html?reparto=${encodeURIComponent(id)}`;

            const icona = document.createElement('i');
            icona.className = 'fa-solid fa-industry';
            icona.setAttribute('aria-hidden', 'true');
            link.appendChild(icona);
            link.appendChild(document.createTextNode(' ' + info.nome));

            contenitore.appendChild(link);
        }
        stato.textContent = '';
    } catch (errore) {
        stato.className = 'stato-caricamento errore';
        stato.innerHTML = 'Impossibile caricare i reparti. <button type="button" id="riprova-reparti">Riprova</button>';
        document.getElementById('riprova-reparti').addEventListener('click', caricaIndice);
    }
}
caricaIndice();
