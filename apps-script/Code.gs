/**
 * Code.gs — Web App de persistência para o artefato de atribuição.
 *
 * doGet  → { disciplinas: [...], professores: [...] }  (leitura pública)
 * doPost → autentica pelo ID token do Google (login) e:
 *          • { idToken }                    → { ok, email, canWrite }  (whoami)
 *          • { idToken, assignments: [...] } → grava se o e-mail for editor
 *
 * Só e-mails em ALLOWED_EMAILS podem gravar; os demais ficam em leitura.
 * Configure SPREADSHEET_ID, OAUTH_CLIENT_ID e ALLOWED_EMAILS abaixo.
 * Deploy: Implantar › Nova implantação › App da Web › Executar como: você ›
 *         Quem tem acesso: Qualquer pessoa. Copie a URL /exec para o app (⚙).
 */

// ==== Configuração ====
var SPREADSHEET_ID = "1x-H5cIxhGhh-0fs2JGZ-AUifTzWKldbWiImEze8OjTM";
// Client ID do OAuth (Web application) criado no Google Cloud — o mesmo usado no
// site. Serve para conferir que o ID token foi emitido para este app.
var OAUTH_CLIENT_ID = "23226739408-vs77ncdednf9vh3ijjemf9s6vfc1ub1c.apps.googleusercontent.com";
// E-mails que podem gravar (minúsculo). Os demais ficam em somente leitura.
var ALLOWED_EMAILS = ["moiseis@gmail.com"];
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

// Verifica o ID token do Google via endpoint oficial tokeninfo. Retorna
// { ok, email, error } — ok apenas se assinatura/validade/audiência conferem.
function _verifyIdToken(idToken) {
  if (!idToken) return { ok: false, error: "Sem login." };
  try {
    var resp = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) {
      return { ok: false, error: "Login inválido ou expirado." };
    }
    var info = JSON.parse(resp.getContentText());
    if (info.aud !== OAUTH_CLIENT_ID) {
      return { ok: false, error: "Token emitido para outro aplicativo." };
    }
    if (String(info.email_verified) !== "true") {
      return { ok: false, error: "E-mail não verificado." };
    }
    return { ok: true, email: String(info.email || "").toLowerCase() };
  } catch (err) {
    return { ok: false, error: "Falha ao verificar login: " + err };
  }
}

function _isEditor(email) {
  for (var i = 0; i < ALLOWED_EMAILS.length; i++) {
    if (String(ALLOWED_EMAILS[i]).toLowerCase() === email) return true;
  }
  return false;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var auth = _verifyIdToken(body.idToken);
    if (!auth.ok) return _json({ ok: false, error: auth.error });
    var canWrite = _isEditor(auth.email);

    // whoami: sem atribuições, só devolve identidade/permissão.
    if (!body.assignments) {
      return _json({ ok: true, email: auth.email, canWrite: canWrite });
    }
    if (!canWrite) {
      return _json({ ok: false, email: auth.email, canWrite: false, error: "Sem permissão de escrita." });
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
    return _json({ ok: true, email: auth.email, canWrite: true, updated: updated });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
