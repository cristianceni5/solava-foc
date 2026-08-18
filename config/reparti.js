// Scritto da Cristian Ceni 08/07/26
// File per la gestione dei reparti

const REPARTI = {
    cava: { nome: "Prelavorazione - Cava", codiceReparto: "03" },
    tlingl: { nome: "Trafila Lingl", codiceReparto: "02" },
    tcape: { nome: "Trafila Capelletti", codiceReparto: "01" },
    clingl: { nome: "Carico Lingl", codiceReparto: "05" },
    ccape: { nome: "Carico Capelletti", codiceReparto: "04" },
    slingl: { nome: "Scarico Lingl", codiceReparto: "07" },
    scape: { nome: "Scarico Capelletti", codiceReparto: "06" },
}

function getReparto(id) {
    return REPARTI[id] || null;
}

module.exports = { REPARTI, getReparto };