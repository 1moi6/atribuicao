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

  // ---- Casamento tolerante de cabeçalhos ---------------------------------
  // Normaliza um nome de coluna: sem acento, minúsculo, só letras/números.
  //   "Professor(a)" → "professora" ; "Horário" → "horario" ; "C.H." → "ch"
  function normalizeKey(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // Um cabeçalho combina com um alias se for igual ao alias OU (para aliases
  // com 5+ chars) começar por ele — cobre "Docentes por ordem…", "Cursos" etc.
  // Aliases curtos (ch, id, n) exigem igualdade exata para não haver colisão.
  function headerMatches(normHeader, alias) {
    if (normHeader === alias) return true;
    return alias.length >= 5 && normHeader.startsWith(alias);
  }

  // Specs em ORDEM CANÔNICA (usada no fallback posicional).
  const SPEC_DISC = [
    { key: "Ordem", aliases: ["ordem", "order", "numero", "num", "no", "n", "id", "item", "indice"] },
    { key: "Curso", aliases: ["curso", "cursos", "course"] },
    { key: "Disciplina", aliases: ["disciplina", "disciplinas", "materia", "componente", "componentecurricular", "discipline"] },
    { key: "Horario", aliases: ["horario", "horarios", "horariocodigo", "codigohorario", "schedule"] },
    { key: "CH", aliases: ["ch", "cargahoraria", "cargahorariatotal", "chtotal", "carga"] },
    { key: "Professor(a)", aliases: ["professora", "professor", "professores", "professorresponsavel", "docenteresponsavel", "responsavel", "docente", "docentes", "prof"] },
  ];
  const SPEC_PROF = [
    { key: "Ordem", aliases: ["ordem", "order", "numero", "num", "no", "n", "id"] },
    { key: "Docentes", aliases: ["docentes", "docente", "professor", "professora", "professores", "nome", "nomes", "professorresponsavel"] },
  ];

  // Resolve, para um conjunto de registros brutos, qual coluna de origem
  // alimenta cada campo canônico. 1) casa por cabeçalho (tolerante);
  // 2) para campos não resolvidos, usa a coluna na posição canônica se estiver
  // livre. Retorna registros reordenados no schema canônico.
  function remapRecords(rawRows, specs) {
    if (!rawRows || !rawRows.length) return [];
    const sourceKeys = Object.keys(rawRows[0]); // ordem das colunas preservada
    const normKeys = sourceKeys.map(normalizeKey);
    const used = new Set();
    const mapping = {};

    // 1) Casamento por cabeçalho.
    for (const spec of specs) {
      for (let i = 0; i < sourceKeys.length; i++) {
        if (used.has(i)) continue;
        if (spec.aliases.some((a) => headerMatches(normKeys[i], a))) {
          mapping[spec.key] = sourceKeys[i];
          used.add(i);
          break;
        }
      }
    }
    // 2) Fallback posicional para campos ainda sem coluna.
    specs.forEach((spec, idx) => {
      if (mapping[spec.key] != null) return;
      if (sourceKeys[idx] != null && !used.has(idx)) {
        mapping[spec.key] = sourceKeys[idx];
        used.add(idx);
      }
    });

    return rawRows.map((r) => {
      const o = {};
      for (const spec of specs) o[spec.key] = mapping[spec.key] != null ? r[mapping[spec.key]] : "";
      return o;
    });
  }

  function toNum(v) {
    if (v === "" || v == null) return "";
    const n = Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : "";
  }

  // Normaliza registros vindos de qualquer fonte para o schema esperado.
  function normalizeDisciplinas(arr) {
    return remapRecords(arr, SPEC_DISC)
      .map((d) => ({
        Ordem: toNum(d.Ordem),
        Curso: String(d.Curso || "").trim(),
        Disciplina: String(d.Disciplina || "").trim(),
        Horario: String(d.Horario || "").trim(),
        CH: toNum(d.CH),
        "Professor(a)": String(d["Professor(a)"] || "").trim(),
      }))
      .filter((d) => d.Ordem !== "" || d.Disciplina);
  }
  function normalizeProfessores(arr) {
    return remapRecords(arr, SPEC_PROF)
      .map((p) => ({ Ordem: toNum(p.Ordem), Docentes: String(p.Docentes || "").trim() }))
      .filter((p) => p.Docentes);
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
