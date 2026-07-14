/**
 * Code.gs — Web App de persistência para o artefato de atribuição.
 *
 * doGet  → { disciplinas: [...], professores: [...] }  (leitura pública)
 * doPost → aplica atribuições no Sheet (exige token de escrita)
 *
 * Configure SPREADSHEET_ID e WRITE_TOKEN abaixo (ou nas Propriedades do Script).
 * Deploy: Implantar › Nova implantação › App da Web › Executar como: você ›
 *         Quem tem acesso: Qualquer pessoa. Copie a URL /exec para o app (⚙).
 */

// ==== Configuração ====
var SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA";
var WRITE_TOKEN = "COLE_AQUI_UM_TOKEN_SECRETO"; // exigido para gravar
var SHEET_DISCIPLINAS = "Disciplinas";
var SHEET_PROFESSORES = "Professores";

function _ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function _sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { header: values[0] || [], rows: [] };
  var header = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r.every(function (c) { return c === "" || c === null; })) continue;
    var obj = {};
    for (var j = 0; j < header.length; j++) obj[header[j]] = r[j];
    rows.push(obj);
  }
  return { header: header, rows: rows };
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  try {
    var ss = _ss();
    var dis = _sheetToObjects(ss.getSheetByName(SHEET_DISCIPLINAS));
    var prof = _sheetToObjects(ss.getSheetByName(SHEET_PROFESSORES));
    return _json({ ok: true, disciplinas: dis.rows, professores: prof.rows });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (body.token !== WRITE_TOKEN) {
      return _json({ ok: false, error: "Token inválido." });
    }
    var assignments = body.assignments || [];
    var ss = _ss();
    var sheet = ss.getSheetByName(SHEET_DISCIPLINAS);
    var values = sheet.getDataRange().getValues();
    var header = values[0].map(function (h) { return String(h).trim(); });

    var colOrdem = header.indexOf("Ordem");
    var colProf = header.indexOf("Professor(a)");
    if (colProf < 0) colProf = header.indexOf("Professor Responsável");
    if (colOrdem < 0 || colProf < 0) {
      return _json({ ok: false, error: "Cabeçalho sem 'Ordem' ou 'Professor(a)'." });
    }

    // Índice Ordem → número da linha (1-based na planilha).
    var ordemToRow = {};
    for (var i = 1; i < values.length; i++) {
      var o = values[i][colOrdem];
      if (o !== "" && o !== null) ordemToRow[Number(o)] = i + 1;
    }

    var updated = 0;
    for (var k = 0; k < assignments.length; k++) {
      var a = assignments[k];
      var row = ordemToRow[Number(a.ordem)];
      if (row) {
        sheet.getRange(row, colProf + 1).setValue(a.professor || "");
        updated++;
      }
    }
    return _json({ ok: true, updated: updated });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
