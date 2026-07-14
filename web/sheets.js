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

  // Specs em ORDEM CANÔNICA (usada no fallback posicional). `label` é exibido
  // no painel de mapeamento.
  const SPEC_DISC = [
    { key: "Ordem", label: "Ordem", aliases: ["ordem", "order", "numero", "num", "no", "n", "id", "item", "indice"] },
    { key: "Curso", label: "Curso", aliases: ["curso", "cursos", "course"] },
    { key: "Disciplina", label: "Disciplina", aliases: ["disciplina", "disciplinas", "materia", "componente", "componentecurricular", "discipline"] },
    { key: "Horario", label: "Horário", aliases: ["horario", "horarios", "horariocodigo", "codigohorario", "schedule"] },
    { key: "CH", label: "CH (carga horária)", aliases: ["ch", "cargahoraria", "cargahorariatotal", "chtotal", "carga"] },
    { key: "Professor(a)", label: "Professor(a)", aliases: ["professora", "professor", "professores", "professorresponsavel", "docenteresponsavel", "responsavel", "docente", "docentes", "prof"] },
  ];
  const SPEC_PROF = [
    { key: "Ordem", label: "Ordem", aliases: ["ordem", "order", "numero", "num", "no", "n", "id"] },
    { key: "Docentes", label: "Docente (nome)", aliases: ["docentes", "docente", "professor", "professora", "professores", "nome", "nomes", "professorresponsavel"] },
  ];
  const SPECS = { disc: SPEC_DISC, prof: SPEC_PROF };

  function headersOf(rawRows) {
    return rawRows && rawRows.length ? Object.keys(rawRows[0]) : [];
  }

  // Sugere qual coluna de origem alimenta cada campo canônico.
  // 1) casa por cabeçalho (tolerante); 2) fallback posicional (posição canônica
  // se livre). Retorna { campoKey: colunaOrigem | null }.
  function suggestMapping(kind, sourceKeys) {
    const specs = SPECS[kind];
    const normKeys = sourceKeys.map(normalizeKey);
    const used = new Set();
    const mapping = {};
    for (const spec of specs) {
      mapping[spec.key] = null;
      for (let i = 0; i < sourceKeys.length; i++) {
        if (used.has(i)) continue;
        if (spec.aliases.some((a) => headerMatches(normKeys[i], a))) {
          mapping[spec.key] = sourceKeys[i];
          used.add(i);
          break;
        }
      }
    }
    specs.forEach((spec, idx) => {
      if (mapping[spec.key] != null) return;
      if (sourceKeys[idx] != null && !used.has(idx)) {
        mapping[spec.key] = sourceKeys[idx];
        used.add(idx);
      }
    });
    return mapping;
  }

  // Reordena registros brutos no schema canônico usando um mapeamento explícito.
  function remapWithMapping(rawRows, kind, mapping) {
    const specs = SPECS[kind];
    return rawRows.map((r) => {
      const o = {};
      for (const spec of specs) {
        const src = mapping[spec.key];
        o[spec.key] = src != null && src !== "" ? r[src] : "";
      }
      return o;
    });
  }

  function toNum(v) {
    if (v === "" || v == null) return "";
    const n = Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : "";
  }

  function coerce(kind, rows) {
    if (kind === "disc") {
      return rows
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
    return rows
      .map((p) => ({ Ordem: toNum(p.Ordem), Docentes: String(p.Docentes || "").trim() }))
      .filter((p) => p.Docentes);
  }

  // Aplica um mapeamento (do painel) e devolve os registros já no schema final.
  function applyMapping(kind, rawRows, mapping) {
    return coerce(kind, remapWithMapping(rawRows, kind, mapping));
  }

  // Auto (usado na leitura da planilha): sugere e aplica em um passo.
  function normalizeDisciplinas(arr) {
    if (!arr || !arr.length) return [];
    return applyMapping("disc", arr, suggestMapping("disc", headersOf(arr)));
  }
  function normalizeProfessores(arr) {
    if (!arr || !arr.length) return [];
    return applyMapping("prof", arr, suggestMapping("prof", headersOf(arr)));
  }

  const fieldsOf = (kind) => SPECS[kind].map((s) => ({ key: s.key, label: s.label }));

  // ---- Leitura de .xlsx (SheetJS) ---------------------------------------
  // Lê um workbook e devolve { nomeAba: [registros] }, com a 1ª linha como
  // cabeçalho; descarta colunas sem título e linhas vazias.
  function readWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const sheets = {};
    wb.SheetNames.forEach((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false });
      const clean = rows
        .map((r) => {
          const o = {};
          Object.keys(r).forEach((k) => {
            if (!/^__EMPTY/.test(k) && String(k).trim() !== "") o[k] = r[k];
          });
          return o;
        })
        .filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
      if (clean.length) sheets[name] = clean;
    });
    return sheets;
  }

  // Quantos campos (fora "Ordem", ambíguo) casam por cabeçalho — usado para
  // adivinhar qual aba é de disciplinas e qual é de docentes.
  function countHeaderMatches(kind, headers) {
    const norm = headers.map(normalizeKey);
    let c = 0;
    for (const spec of SPECS[kind]) {
      if (spec.key === "Ordem") continue;
      if (norm.some((nk) => spec.aliases.some((a) => headerMatches(nk, a)))) c++;
    }
    return c;
  }

  // Detecta, num conjunto de abas, qual alimenta disciplinas e qual docentes.
  function detectSheets(sheets) {
    const names = Object.keys(sheets);
    const scoreD = {}, scoreP = {};
    names.forEach((n) => {
      const h = headersOf(sheets[n]);
      scoreD[n] = countHeaderMatches("disc", h);
      scoreP[n] = countHeaderMatches("prof", h);
    });
    let disc = null, best = -1;
    names.forEach((n) => { if (scoreD[n] > best) { best = scoreD[n]; disc = n; } });
    let prof = null; best = -1;
    names.forEach((n) => {
      if (n === disc && names.length > 1) return;
      if (scoreP[n] > best) { best = scoreP[n]; prof = n; }
    });
    return { disc, prof };
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
    headersOf,
    fieldsOf,
    suggestMapping,
    applyMapping,
    readWorkbook,
    detectSheets,
    fetchFromSheet,
    saveAssignments,
  };
})();
