// Autori: Cristian Ceni, Codex
// Ultima modifica: 10/10/2026
// Scopo: analisi dei report sull'uso del FOP

/* Calcoli puri condivisi dai report; nessuna dipendenza dal DOM o dalle API. */
const AnalisiReport = (() => {
    const nomePagina = pagina => ({ '/': 'Pannello', '/index.html': 'Pannello', '/paginaReparto.html': 'Monitor reparto', '/paginaPcConnessi.html': 'Computer connessi', '/paginaReportPcConnessi.html': 'Report computer', '/paginaSalvataggi.html': 'Salvataggi', '/paginaReportSalvataggi.html': 'Report salvataggi', '/paginaEtichetta.html': 'Etichette', '/paginaQuantitaBolla.html': 'Quantità bolla', '/paginaControllo.html': 'Controllo attributi', '/documentazione.html': 'Documentazione', '/autenticazione.html': 'Accesso' })[pagina] || pagina;
    const durata = secondi => {
        const minuti = Math.round((secondi || 0) / 60);
        return `${Math.floor(minuti / 60)} h ${minuti % 60} min`;
    };
    function usiPc(records) {
        const pagine = new Map();
        for (const pc of records) for (const uso of pc.usi || []) {
            const nome = nomePagina(uso.pagina) + (uso.reparto ? ` · ${uso.nomeReparto || uso.reparto}` : '');
            pagine.set(nome, (pagine.get(nome) || 0) + uso.rilevazioni);
        }
        return [...pagine].sort((a, b) => b[1] - a[1]);
    }
    function riepilogoPc(records) {
        const usi = usiPc(records);
        return [
            { etichetta: 'Computer rilevati', valore: records.length, tipo: 'metrica' },
            { etichetta: 'Tempo osservato (stimato)', valore: durata(records.reduce((n, pc) => n + pc.secondiOsservati, 0)), tipo: 'metrica' },
            { etichetta: 'Rilevazioni ricevute', valore: records.reduce((n, pc) => n + pc.rilevazioni, 0), tipo: 'metrica' },
            { etichetta: 'Pagina più rilevata', ampio: true, valore: usi[0] ? usi[0][0] : '—', descrizione: usi[0] ? `${usi[0][1]} rilevazioni nella giornata.` : '' },
            { etichetta: 'Dove viene usato il FOP', ampio: true, voci: usi.map(([nome, numero]) => ({ etichetta: nome, valore: numero })) }
        ];
    }
    function salvataggi(records) {
        const ordinati = records.filter(r => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(String(r.DATA_ORA))).slice().sort((a,b) => String(a.DATA_ORA).localeCompare(String(b.DATA_ORA)));
        const anomalie = records.filter(r => r.RICETTA_OMR == null || r.RICETTA_MES == null || String(r.RICETTA_OMR).trim() === '' || String(r.RICETTA_MES).trim() === '' || String(r.RICETTA_OMR).trim() !== String(r.RICETTA_MES).trim()).length;
        const frasi = [`${records.length} salvataggi nella giornata: ${records.length - anomalie} con ricette coincidenti, ${anomalie} con ricette diverse o incomplete.`];
        if (ordinati.length) frasi.push(`Le registrazioni coprono dalle ${String(ordinati[0].DATA_ORA).slice(11,19)} alle ${String(ordinati.at(-1).DATA_ORA).slice(11,19)}. Questa finestra descrive i dati disponibili, non le ore di lavoro dell'impianto.`);
        if (records.length !== ordinati.length) frasi.push(`${records.length - ordinati.length} registrazioni non hanno un orario riconoscibile.`);
        const numeri = campo => records.map(r => r[campo]).filter(v => v !== null && v !== undefined && String(v).trim() !== '').map(Number).filter(Number.isFinite);
        const terra = numeri('TONN_TERRA');
        if (terra.length) frasi.push(`Terra: letture da ${Math.min(...terra).toLocaleString('it-IT')} a ${Math.max(...terra).toLocaleString('it-IT')} t. Le letture non vengono sommate per ricavare la produzione.`);
        for (const linea of [1, 2]) {
            const valori = records.map(r => {
                const ore = r[`ORE_IMP_LAVORAZIONE_L${linea}`], minuti = r[`MIN_IMP_LAVORAZIONE_L${linea}`];
                if (ore == null || minuti == null || String(ore).trim() === '' || String(minuti).trim() === '') return null;
                const totale = Number(ore) * 60 + Number(minuti);
                return Number.isFinite(totale) && totale >= 0 ? totale : null;
            }).filter(v => v !== null);
            if (valori.length) frasi.push(`Linea ${linea}: tempo di lavorazione letto tra ${durata(Math.min(...valori) * 60)} e ${durata(Math.max(...valori) * 60)} in ${valori.length} registrazioni. Non equivale automaticamente al lavoro svolto nella giornata.`);
        }
        const cassoni = [1,2,3,4,5].map(n => ({ n, valori: numeri(`HZ_CASSONE_${n}`) })).filter(c => c.valori.length);
        if (cassoni.length) frasi.push('Cassoni, intervalli di frequenza osservati: ' + cassoni.map(c => `${c.n}: ${Math.min(...c.valori)}–${Math.max(...c.valori)} Hz`).join('; ') + '.');
        frasi.push('Il riepilogo riguarda i salvataggi caricati (massimo 500): una giornata può essere parziale. Seleziona un evento per verificare le singole letture.');
        return frasi;
    }
    return { durata, nomePagina, usiPc, riepilogoPc, salvataggi };
})();
if (typeof module !== 'undefined') module.exports = AnalisiReport;
