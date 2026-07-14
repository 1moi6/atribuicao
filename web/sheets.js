/*
 * sheets.js — cliente do Apps Script Web App + parsing/serialização CSV.
 * Persistência: GET carrega { disciplinas, professores }; POST grava atribuições
 * (protegido por token). Config (endpoint + token) guardada em localStorage.
 * Exposto em window.Store.
 */
(function () {
  "use strict";

  const LS_ENDPOINT = "atribuicao.endpoint";
  const LS_TOKEN = "atribuicao.token";

  const DISC_COLS = ["Ordem", "Curso", "Disciplina", "Horario", "CH", "Professor(a)"];
  const PROF_COLS = ["Ordem", "Docentes"];

  function getConfig() {
    return {
      endpoint: localStorage.getItem(LS_ENDPOINT) || "",
      token: localStorage.getItem(LS_TOKEN) || "",
    };
  }
  function setConfig(endpoint, token) {
    if (endpoint != null) localStorage.setItem(LS_ENDPOINT, endpoint.trim());
    if (token != null) localStorage.setItem(LS_TOKEN, token.trim());
  }

  // ---- CSV ---------------------------------------------------------------
  // Parser simples com suporte a aspas e vírgulas dentro de campos.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function csvToObjects(text) {
    const rows = parseCSV(text).filter((r) => r.length && r.some((c) => c !== ""));
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      header.forEach((h, i) => (obj[h] = (r[i] !== undefined ? r[i] : "").trim()));
      return obj;
    });
  }

  function escapeCSV(v) {
    v = v == null ? "" : String(v);
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function objectsToCSV(objs, cols) {
    const lines = [cols.join(",")];
    for (const o of objs) lines.push(cols.map((c) => escapeCSV(o[c])).join(","));
    return lines.join("\n");
  }

  // Normaliza registros vindos de qualquer fonte para o schema esperado.
  function normalizeDisciplinas(arr) {
    return arr.map((d) => ({
      Ordem: Number(d.Ordem),
      Curso: d.Curso || "",
      Disciplina: d.Disciplina || "",
      Horario: (d.Horario || d["Horário"] || "").trim(),
      CH: d.CH === "" || d.CH == null ? "" : Number(d.CH),
      "Professor(a)": (d["Professor(a)"] || d["Professor Responsável"] || "").trim(),
    }));
  }
  function normalizeProfessores(arr) {
    return arr.map((p) => ({ Ordem: Number(p.Ordem), Docentes: p.Docentes || "" }));
  }

  // ---- Rede (Apps Script) -----------------------------------------------
  async function fetchFromSheet() {
    const { endpoint } = getConfig();
    if (!endpoint) throw new Error("Endpoint do Apps Script não configurado.");
    const res = await fetch(endpoint, { method: "GET" });
    if (!res.ok) throw new Error("Falha ao carregar (HTTP " + res.status + ")");
    const data = await res.json();
    return {
      disciplinas: normalizeDisciplinas(data.disciplinas || []),
      professores: normalizeProfessores(data.professores || []),
    };
  }

  // Grava uma lista de atribuições [{ordem, professor}]. Usa text/plain para
  // evitar preflight CORS com o Apps Script.
  async function saveAssignments(assignments) {
    const { endpoint, token } = getConfig();
    if (!endpoint) throw new Error("Endpoint do Apps Script não configurado.");
    if (!token) throw new Error("Token de escrita não configurado.");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, assignments }),
    });
    if (!res.ok) throw new Error("Falha ao salvar (HTTP " + res.status + ")");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Erro ao salvar.");
    return data;
  }

  window.Store = {
    DISC_COLS,
    PROF_COLS,
    getConfig,
    setConfig,
    parseCSV,
    csvToObjects,
    objectsToCSV,
    normalizeDisciplinas,
    normalizeProfessores,
    fetchFromSheet,
    saveAssignments,
  };
})();
