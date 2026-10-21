// Autori: Cristian Ceni
// Ultima modifica: 21/10/2026
// Scopo: esportazione tabella da HTML a Excel

function exportTableToExcel(transactionsTable, filename = '') {
    let downloadLink;
    const dataType = 'application/vnd.ms-excel';
    const tableSelect = document.getElementById(transactionsTable);
    const tableHTML = tableSelect.outerHTML.replace(/ /g, '%20');

    // Specify file name
    filename = filename ? filename + '.xls' : 'excel_data.xls';

    // Create download link element
    downloadLink = document.createElement("a");

    document.body.appendChild(downloadLink);

    if (navigator.msSaveOrOpenBlob) {
        var blob = new Blob(['\ufeff', tableHTML], {
            type: dataType
        });
        navigator.msSaveOrOpenBlob(blob, filename);
    } else {
        // Create a link to the file
        downloadLink.href = 'data:' + dataType + ', ' + tableHTML;

        // Setting the file name
        downloadLink.download = filename;

        //triggering the function
        downloadLink.click();
    }

    window.location.reload();
}

function clickButton(idTabella, nomeTabella) {
    const button = document.getElementById("excel-salvataggi");
    button.onclick = exportTableToExcel(idTabella, nomeTabella);
}

