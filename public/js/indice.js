// Scritto da Cristian Ceni 22/07/26
// Porting dello script inline di index

let consensoAuto, abilitazioneIndietro;

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

async function caricaImpostazioni() {
  const checkAutomatico = document.getElementById('check-auto');
  const minutiRiapertura = document.getElementById('minuti-riapertura');

  try {
    const res = await fetch('/api/automazione');
    if (res.ok) {
      const risposta = await res.json();
      const configurazione = Array.isArray(risposta) ? risposta[0] : risposta;
      consensoAuto = Boolean(configurazione.consenso ?? configurazione.consensoAuto);
      if (checkAutomatico) checkAutomatico.checked = consensoAuto;
      if (minutiRiapertura) minutiRiapertura.value = configurazione.minuti ?? 0;
    }
  } catch (err) {
    console.error('Errore recupero consenso iniziale:', err);
  }

  const salvaImpostazioni = async () => {
    consensoAuto = checkAutomatico?.checked ?? consensoAuto;
    const minuti = minutiRiapertura?.value ?? 0;

    try {
      const res = await fetch('/api/set-automazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consensoAuto, minuti })
      });
      if (!res.ok) throw new Error('Risposta non valida');
    } catch (error) {
      console.error("Errore durante l'invio:", error);
    }
  };

  checkAutomatico?.addEventListener('change', salvaImpostazioni);
  minutiRiapertura?.addEventListener('change', salvaImpostazioni);
}

caricaImpostazioni();
caricaIndice();
