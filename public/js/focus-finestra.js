
// Scritto da Cristian Ceni 19/08/26
// Test per il focus finestra quando abbassata

// Tempo di controllo
const OGNI_QUANTO = 3000;

if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

let notificaInviata = false

// Controllo minimizzazione
/*
setInterval(() => {
    if (document.hidden) {
        // Se è nascosta e non l'ho ancora mandata, ne mando una sola
        if (!notificaInviata) {
            mostraNotificaFocus();
            notificaInviata = true;
        }
    } else {
        notificaInviata = false;
    }
}, OGNI_QUANTO);
*/
// Mostro notifica minimizzazione
function mostraNotificaFocus() {
    if (Notification.permission === "granted") {
        const notifica = new Notification("Solava Factory Operation Panel", {
            body: "Clicca qui per tornare alla schermata delle informazioni.",
            icon: "./assets/logo-solava-rid.png",
            requireInteraction: true // Resta sullo schermo
        });

        notifica.onclick = function () {
            window.focus();
            parent.focus();
            notifica.close();

            notificaInviata = false;
        };

        notifica.onclose = function () {
            notificaInviata = false;
        };
    }
}
