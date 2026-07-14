/*
 * export.js — exportações: planilha de encargos (.xlsx), CSV de trabalho e PDF.
 * Usa SheetJS (window.XLSX, vendorizado). PDF via window.print() + CSS de impressão.
 * Exposto em window.Exporter.
 */
(function () {
  "use strict";

  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Planilha de encargos: aba "Disciplinas" (com "Professor Responsável"
  // preenchido) + aba "Professores". Layout compatível com a planilha usada.
  function exportarXlsx(disciplinas, professores, nomeArquivo) {
    const wb = XLSX.utils.book_new();

    const disHeader = ["Ordem", "Curso", "Disciplina", "Horário", "CH", "Professor Responsável"];
    const disRows = disciplinas
      .slice()
      .sort((a, b) => a.Ordem - b.Ordem)
      .map((d) => [d.Ordem, d.Curso, d.Disciplina, d.Horario, d.CH, d["Professor(a)"] || ""]);
    const wsDis = XLSX.utils.aoa_to_sheet([disHeader, ...disRows]);
    wsDis["!cols"] = [
      { wch: 6 }, { wch: 24 }, { wch: 42 }, { wch: 20 }, { wch: 6 }, { wch: 34 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDis, "Disciplinas");

    const profHeader = ["Ordem", "Docentes"];
    const profRows = professores
      .slice()
      .sort((a, b) => a.Ordem - b.Ordem)
      .map((p) => [p.Ordem, p.Docentes]);
    const wsProf = XLSX.utils.aoa_to_sheet([profHeader, ...profRows]);
    wsProf["!cols"] = [{ wch: 6 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(wb, wsProf, "Professores");

    XLSX.writeFile(wb, nomeArquivo || "encargos.xlsx");
  }

  // CSV de trabalho (re-importável): mesmo schema interno das disciplinas.
  function exportarCsv(disciplinas, nomeArquivo) {
    const csv = Store.objectsToCSV(
      disciplinas.slice().sort((a, b) => a.Ordem - b.Ordem),
      Store.DISC_COLS
    );
    baixarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), nomeArquivo || "disciplinas.csv");
  }

  // PDF: prepara o body para impressão do relatório e chama window.print().
  function exportarPdf() {
    document.body.classList.add("modo-impressao");
    window.print();
    // remove a classe depois do diálogo de impressão
    setTimeout(() => document.body.classList.remove("modo-impressao"), 500);
  }

  window.Exporter = { exportarXlsx, exportarCsv, exportarPdf };
})();
