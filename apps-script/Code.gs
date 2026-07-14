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

// Normaliza um nome de coluna: sem acento, minúsculo, só letras/números.
function _normKey(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Localiza a coluna cujo cabeçalho casa (igual, ou começa por alias de 5+ chars)
// com algum dos aliases. Retorna o índice ou -1.
function _findCol(header, aliases) {
  var norm = header.map(_normKey);
  for (var i = 0; i < norm.length; i++) {
    for (var j = 0; j < aliases.length; j++) {
      var a = aliases[j];
      if (norm[i] === a || (a.length >= 5 && norm[i].indexOf(a) === 0)) return i;
    }
  }
  return -1;
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

    // Resolução tolerante (maiúsc./acentos/pontuação); fallback posicional:
    // Ordem = 1ª coluna, Professor = última coluna (layout canônico).
    var colOrdem = _findCol(header, ["ordem", "order", "numero", "num", "id"]);
    if (colOrdem < 0) colOrdem = 0;
    var colProf = _findCol(header, [
      "professora", "professor", "professores", "professorresponsavel",
      "docenteresponsavel", "responsavel", "docente"
    ]);
    if (colProf < 0) colProf = header.length - 1;

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
