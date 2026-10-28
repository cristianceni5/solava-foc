// Autori: Cristian Ceni
// Ultima modifica: 23/10/2026
// Scopo: esportazione Excel delle tabelle - file universale

// Esportazione delle tabelle nel formato HTML compatibile con Excel (.xls).
function exportTableToExcel(idTabella, nomeFile = 'excel_data', datiCompleti) {
    const tabella = document.getElementById(idTabella);
    if (!tabella) return;

    const escapeHtml = valore => valore.replace(/[&<>"']/g, carattere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[carattere]);
    // Esporta solo il testo: esclude pulsanti, link e attributi della pagina.
    const dati = datiCompleti || Array.from(tabella.rows, riga => Array.from(riga.cells, cella => cella.textContent.trim()));
    const righe = Array.from(dati, riga => '<tr>' + Array.from(riga, valore =>
        '<td style=\'mso-number-format:"\\@"\'>' + escapeHtml(String(valore ?? '')) + '</td>'
    ).join('') + '</tr>').join('');
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table>' + righe + '</table></body></html>';
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const nome = nomeFile + '.xls';
    if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, nome);
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Compatibilità con le pagine che chiamano ancora clickButton dall'HTML.
function clickButton(idTabella, nomeTabella) {
    exportTableToExcel(idTabella, nomeTabella);
}
