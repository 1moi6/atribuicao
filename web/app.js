/*
 * app.js — estado, navegação e renderização das views.
 * Depende de window.Logic, window.Store, window.Exporter, window.XLSX.
 */
(function () {
  "use strict";

  const LS_THEME = "atribuicao.theme";
  const LS_META = "atribuicao.metaCH";

  const state = {
    disciplinas: [],
    professores: [],
    selProf: null,
    selDiscOrdem: null,
    dirty: new Set(),
    metaCH: Number(localStorage.getItem(LS_META) || 0),
    tab: "atribuicao",
    readOnly: true,
  };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Helpers de dados ----------
  const disciplinasDoProf = (nome) => state.disciplinas.filter((d) => (d["Professor(a)"] || "") === nome);
  const chDoProf = (nome) =>
    disciplinasDoProf(nome).reduce((s, d) => s + (Number(d.CH) || 0), 0);
  const livres = () => state.disciplinas.filter((d) => !(d["Professor(a)"] || "").trim());
  const discPorOrdem = (ordem) => state.disciplinas.find((d) => d.Ordem === Number(ordem));

  // ---------- Atribuição ----------
  function atribuir(ordem, professor) {
    const d = discPorOrdem(ordem);
    if (!d) return;
    d["Professor(a)"] = professor;
    state.dirty.add(Number(ordem));
    refreshChrome();
    render();
  }
  function desatribuir(ordem) {
    const d = discPorOrdem(ordem);
    if (!d) return;
    d["Professor(a)"] = "";
    state.dirty.add(Number(ordem));
    refreshChrome();
    render();
  }

  // ---------- Persistência ----------
  async function carregar() {
    setStatus("…", "");
    try {
      const data = await Store.fetchFromSheet();
      state.disciplinas = data.disciplinas;
      state.professores = data.professores;
      state.dirty.clear();
      refreshChrome();
      render();
      toast("Dados carregados do Drive.", "ok");
    } catch (e) {
      setStatus("offline", "err");
      toast("Não foi possível carregar: " + e.message, "err");
      render();
    }
  }

  async function salvar() {
    if (!state.dirty.size) return toast("Nada a salvar.", "");
    const cfg = Store.getConfig();
    if (!cfg.token) return toast("Configure o token de escrita para salvar.", "err");
    const assignments = Array.from(state.dirty).map((ordem) => ({
      ordem,
      professor: (discPorOrdem(ordem)["Professor(a)"] || ""),
    }));
    $("#btn-save").disabled = true;
    try {
      await Store.saveAssignments(assignments);
      state.dirty.clear();
      refreshChrome();
      toast("Atribuições salvas no Drive.", "ok");
    } catch (e) {
      toast("Falha ao salvar: " + e.message, "err");
    } finally {
      $("#btn-save").disabled = false;
    }
  }

  // ---------- Chrome (status, badges, semestre) ----------
  function setStatus(txt, cls) {
    const p = $("#status-conn");
    p.textContent = txt;
    p.className = "status-pill" + (cls ? " " + cls : "");
  }
  function refreshChrome() {
    const cfg = Store.getConfig();
    state.readOnly = !cfg.token;
    const dc = $("#dirty-count");
    dc.textContent = state.dirty.size;
    dc.classList.toggle("hidden", state.dirty.size === 0);
    if (state.disciplinas.length) {
      setStatus(state.readOnly ? "somente leitura" : "conectado", state.readOnly ? "ro" : "ok");
    }
    // rótulo de semestre inferido do curso/dados (livre) — mantém genérico
    $("#semestre-label").textContent = "";
  }

  // ---------- Render dispatcher ----------
  function render() {
    const view = $("#view");
    view.innerHTML = "";
    if (!state.disciplinas.length) return renderEmpty(view);
    ({
      atribuicao: renderAtribuicao,
      grade: renderGrade,
      conflitos: renderConflitos,
      dashboard: renderDashboard,
      distribuicao: renderDistribuicao,
    }[state.tab] || renderAtribuicao)(view);
  }

  function renderEmpty(view) {
    const c = el("div", "empty-state");
    c.innerHTML =
      '<div class="big">📚</div><h2>Nenhum dado carregado</h2>' +
      '<p class="muted">Configure o endpoint do Apps Script e recarregue, ou importe os CSVs em <b>⚙ Configurar</b>.</p>';
    const b = el("button", "btn btn-primary", "Abrir configuração");
    b.onclick = openConfig;
    c.appendChild(b);
    view.appendChild(c);
  }

  // ---------- View: Atribuição ----------
  function renderAtribuicao(view) {
    const wrap = el("div", "grid-2");

    // Coluna esquerda: professores com carga
    const left = el("div", "card");
    left.appendChild(el("h2", null, "Professores"));
    const ul = el("ul", "plist");
    state.professores.forEach((p) => {
      const li = el("li", state.selProf === p.Docentes ? "sel" : "");
      const n = disciplinasDoProf(p.Docentes).length;
      li.innerHTML =
        `<span class="nome">${esc(p.Docentes)}</span>` +
        `<span class="ch">${chDoProf(p.Docentes)}h · ${n}</span>`;
      li.onclick = () => {
        state.selProf = p.Docentes;
        state.selDiscOrdem = null;
        render();
      };
      ul.appendChild(li);
    });
    left.appendChild(ul);
    wrap.appendChild(left);

    // Coluna direita
    const right = el("div", "card");
    if (!state.selProf) {
      right.innerHTML = '<p class="muted">Selecione um professor para atribuir disciplinas.</p>';
      wrap.appendChild(right);
      view.appendChild(wrap);
      return;
    }

    right.appendChild(
      el("h2", null, `${esc(state.selProf)} — ${chDoProf(state.selProf)}h atribuídas`)
    );

    // Já atribuídas
    const atrib = disciplinasDoProf(state.selProf);
    right.appendChild(el("label", null, "Disciplinas atribuídas"));
    if (!atrib.length) {
      right.appendChild(el("p", "muted", "Nenhuma disciplina atribuída."));
    } else {
      atrib.forEach((d) => {
        const item = el("div", "disc-item");
        item.innerHTML =
          `<div><b>${d.Ordem} · ${esc(d.Disciplina)}</b>` +
          `<div class="meta">${esc(d.Horario || "sem horário")} · ${d.CH}h</div></div>`;
        const btn = el("button", "btn", "Remover");
        btn.onclick = () => desatribuir(d.Ordem);
        item.appendChild(btn);
        right.appendChild(item);
      });
    }

    // Atribuir nova (destaca sem conflito)
    right.appendChild(el("div", "modal-sep"));
    right.appendChild(el("label", null, "Atribuir disciplina livre"));
    const semConf = new Set(
      Logic.disciplinasLivresSemConflito(state.disciplinas, state.selProf).map((d) => d.Ordem)
    );
    const livresList = livres().sort((a, b) => a.Ordem - b.Ordem);
    if (!livresList.length) {
      right.appendChild(el("p", "muted", "Não há disciplinas livres."));
    }
    livresList.forEach((d) => {
      const ok = semConf.has(d.Ordem);
      const item = el("div", "disc-item" + (ok ? " livre-ok" : ""));
      item.innerHTML =
        `<div><b>${d.Ordem} · ${esc(d.Disciplina)}</b>` +
        `<div class="meta">${esc(d.Horario || "sem horário")} · ${d.CH}h</div></div>`;
      const rowbtn = el("div", "row");
      rowbtn.appendChild(el("span", "tag " + (ok ? "ok" : "conf"), ok ? "sem conflito" : "conflita"));
      const prev = el("button", "btn", "Prever");
      prev.onclick = () => {
        state.selDiscOrdem = d.Ordem;
        state.tab = "grade";
        setActiveTab("grade");
        render();
      };
      const add = el("button", "btn btn-primary", "Atribuir");
      add.onclick = () => atribuir(d.Ordem, state.selProf);
      rowbtn.appendChild(prev);
      rowbtn.appendChild(add);
      item.appendChild(rowbtn);
      right.appendChild(item);
    });

    wrap.appendChild(right);
    view.appendChild(wrap);
  }

  // ---------- View: Grade ----------
  function renderGrade(view) {
    const card = el("div", "card");
    const bar = el("div", "row");
    bar.appendChild(el("label", null, "Professor:"));
    const sel = el("select");
    sel.style.maxWidth = "320px";
    sel.innerHTML =
      '<option value="">— selecione —</option>' +
      state.professores.map((p) => `<option ${p.Docentes === state.selProf ? "selected" : ""}>${esc(p.Docentes)}</option>`).join("");
    sel.onchange = () => {
      state.selProf = sel.value || null;
      render();
    };
    bar.appendChild(sel);
    if (state.selDiscOrdem) {
      const d = discPorOrdem(state.selDiscOrdem);
      const chip = el("span", "tag ok", "Prevendo: " + esc(d ? d.Disciplina : ""));
      bar.appendChild(chip);
      const clr = el("button", "btn", "Limpar prévia");
      clr.onclick = () => {
        state.selDiscOrdem = null;
        render();
      };
      bar.appendChild(clr);
    }
    card.appendChild(bar);

    if (!state.selProf) {
      card.appendChild(el("p", "muted", "Selecione um professor para ver a grade."));
      view.appendChild(card);
      return;
    }

    let simulada = null;
    if (state.selDiscOrdem) {
      const d = discPorOrdem(state.selDiscOrdem);
      if (d && (d["Professor(a)"] || "") !== state.selProf) simulada = d;
    }
    const { grid, mapa, conflitos } = Logic.buildSchedule(disciplinasDoProf(state.selProf), simulada);

    const wrap = el("div", "grade-wrap");
    const t = el("table", "grade");
    let head = "<tr><th>Hora</th>" + Logic.DAYS.map((d) => `<th>${d}</th>`).join("") + "</tr>";
    let body = "";
    Logic.TIME_SLOTS.forEach((hora) => {
      body += `<tr><td class="hora">${hora}</td>`;
      Logic.DAYS.forEach((dia) => {
        const v = grid[hora][dia];
        const nomes = mapa[dia + "|" + hora];
        const title = nomes.length ? ` title="${esc(nomes.join(", "))}"` : "";
        let cls = "cell-0", txt = "";
        if (v < 0) cls = "cell-pausa";
        else if (v === 1) { cls = "cell-1"; }
        else if (v >= 2) { cls = "cell-2"; txt = v; }
        body += `<td class="${cls}"${title}>${txt}</td>`;
      });
      body += "</tr>";
    });
    t.innerHTML = head + body;
    wrap.appendChild(t);
    card.appendChild(wrap);

    if (conflitos.length) {
      card.appendChild(el("div", "modal-sep"));
      card.appendChild(el("h2", null, `⚠ ${conflitos.length} conflito(s) de horário`));
      const tw = el("div", "table-wrap");
      const ct = el("table", "data");
      ct.innerHTML =
        "<tr><th>Dia</th><th>Hora</th><th>Disciplinas</th></tr>" +
        conflitos.map((c) => `<tr><td>${c.dia}</td><td>${c.hora}</td><td class="sem-prof">${esc(c.disciplinas.join(", "))}</td></tr>`).join("");
      tw.appendChild(ct);
      card.appendChild(tw);
    }
    view.appendChild(card);
  }

  // ---------- View: Conflitos (matriz) ----------
  function renderConflitos(view) {
    const card = el("div", "card");
    card.appendChild(el("h2", null, "Matriz de conflitos entre disciplinas"));
    card.appendChild(
      el("p", "muted", "Vermelho = as duas disciplinas compartilham horário (não podem ir para o mesmo professor).")
    );
    const { ordens, nomes, matriz } = Logic.matrizConflitos(state.disciplinas);

    let pares = 0;
    for (let i = 0; i < ordens.length; i++)
      for (let j = i + 1; j < ordens.length; j++)
        if (matriz[ordens[i]][ordens[j]]) pares++;
    card.appendChild(el("p", null, `<b>${pares}</b> par(es) de disciplinas em conflito.`));

    const wrap = el("div", "matriz-wrap");
    const t = el("table", "matriz");
    let head = "<tr><th></th>" + ordens.map((o) => `<th title="${esc(nomes[o])}">${o}</th>`).join("") + "</tr>";
    let body = "";
    ordens.forEach((a) => {
      body += `<tr><th title="${esc(nomes[a])}">${a}</th>`;
      ordens.forEach((b) => {
        if (a === b) body += '<td class="m-diag"></td>';
        else {
          const conf = matriz[a][b];
          body += `<td class="${conf ? "m-conf" : "m-ok"}" title="${esc(nomes[a])} × ${esc(nomes[b])}"></td>`;
        }
      });
      body += "</tr>";
    });
    t.innerHTML = head + body;
    wrap.appendChild(t);
    card.appendChild(wrap);
    view.appendChild(card);
  }

  // ---------- View: Dashboard ----------
  function renderDashboard(view) {
    const total = state.disciplinas.length;
    const atribuidas = state.disciplinas.filter((d) => (d["Professor(a)"] || "").trim()).length;
    const semProf = total - atribuidas;
    const cobertura = total ? Math.round((atribuidas / total) * 100) : 0;
    const chTotal = state.disciplinas.reduce((s, d) => s + (Number(d.CH) || 0), 0);
    const comCarga = state.professores.filter((p) => chDoProf(p.Docentes) > 0).length;

    // KPIs
    const kpis = el("div", "kpis");
    const mkKpi = (val, lbl, cls) => {
      const k = el("div", "kpi" + (cls ? " " + cls : ""));
      k.innerHTML = `<div class="val">${val}</div><div class="lbl">${lbl}</div>`;
      return k;
    };
    kpis.appendChild(mkKpi(total, "Disciplinas"));
    kpis.appendChild(mkKpi(atribuidas, "Atribuídas", "accent"));
    kpis.appendChild(mkKpi(semProf, "Sem professor", semProf ? "warn" : ""));
    kpis.appendChild(mkKpi(cobertura + "%", "Cobertura"));
    kpis.appendChild(mkKpi(comCarga + "/" + state.professores.length, "Professores com carga"));
    kpis.appendChild(mkKpi(chTotal + "h", "CH total"));
    view.appendChild(kpis);

    // Meta configurável
    const metaCard = el("div", "card");
    metaCard.appendChild(el("h2", null, "Carga horária por professor"));
    const metaRow = el("div", "row");
    metaRow.appendChild(el("label", null, "Meta de CH por professor (0 = escala pela maior carga):"));
    const metaInput = el("input");
    metaInput.type = "text";
    metaInput.style.maxWidth = "120px";
    metaInput.value = state.metaCH || 0;
    metaInput.onchange = () => {
      state.metaCH = Math.max(0, Number(metaInput.value) || 0);
      localStorage.setItem(LS_META, state.metaCH);
      render();
    };
    metaRow.appendChild(metaInput);
    metaCard.appendChild(metaRow);

    const cargas = state.professores
      .map((p) => ({ nome: p.Docentes, ch: chDoProf(p.Docentes), n: disciplinasDoProf(p.Docentes).length }))
      .sort((a, b) => b.ch - a.ch);
    const maxCH = Math.max(1, ...cargas.map((c) => c.ch));
    const ref = state.metaCH > 0 ? state.metaCH : maxCH;

    cargas.forEach((c) => {
      const row = el("div", "loadbar-row");
      row.appendChild(el("div", "loadbar-name", esc(c.nome)));
      const track = el("div", "loadbar-track");
      const fill = el("div", "loadbar-fill");
      const pct = Math.min(100, (c.ch / ref) * 100);
      fill.style.width = pct + "%";
      if (state.metaCH > 0) {
        if (c.ch > state.metaCH) fill.classList.add("over");
        else if (c.ch < state.metaCH * 0.6) fill.classList.add("under");
      }
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("div", "loadbar-val", `${c.ch}h · ${c.n} disc.`));
      metaCard.appendChild(row);
    });
    view.appendChild(metaCard);
  }

  // ---------- View: Distribuição (tabela) ----------
  function renderDistribuicao(view) {
    const card = el("div", "card");
    const bar = el("div", "row");
    const search = el("input");
    search.type = "search";
    search.placeholder = "Filtrar por disciplina, curso ou professor…";
    search.style.maxWidth = "360px";
    bar.appendChild(search);
    const onlySem = el("label");
    onlySem.style.margin = "0";
    onlySem.innerHTML = '<input type="checkbox" id="chk-sem"> Só sem professor';
    bar.appendChild(onlySem);
    card.appendChild(bar);

    const tw = el("div", "table-wrap");
    const t = el("table", "data");
    tw.appendChild(t);
    card.appendChild(tw);
    view.appendChild(card);

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const semOnly = $("#chk-sem").checked;
      const rows = state.disciplinas
        .slice()
        .sort((a, b) => a.Ordem - b.Ordem)
        .filter((d) => {
          const prof = (d["Professor(a)"] || "").trim();
          if (semOnly && prof) return false;
          if (!q) return true;
          return (
            (d.Disciplina || "").toLowerCase().includes(q) ||
            (d.Curso || "").toLowerCase().includes(q) ||
            prof.toLowerCase().includes(q)
          );
        });
      t.innerHTML =
        "<tr><th>#</th><th>Curso</th><th>Disciplina</th><th>Horário</th><th>CH</th><th>Professor</th></tr>" +
        rows
          .map(
            (d) =>
              `<tr><td>${d.Ordem}</td><td>${esc(d.Curso)}</td><td>${esc(d.Disciplina)}</td>` +
              `<td>${esc(d.Horario)}</td><td>${d.CH}</td>` +
              (`<td class="${(d["Professor(a)"] || "").trim() ? "" : "sem-prof"}">${esc((d["Professor(a)"] || "").trim() || "— sem professor —")}</td>`) +
              "</tr>"
          )
          .join("");
    };
    search.oninput = draw;
    onlySem.querySelector("input").onchange = draw;
    draw();
  }

  // ---------- Tabs ----------
  function setActiveTab(tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }

  // ---------- Config / modal ----------
  function openConfig() {
    const cfg = Store.getConfig();
    $("#cfg-endpoint").value = cfg.endpoint;
    $("#cfg-token").value = cfg.token;
    $("#config-modal").classList.remove("hidden");
  }
  function closeConfig() {
    $("#config-modal").classList.add("hidden");
  }

  function importarCSV(file, tipo) {
    const reader = new FileReader();
    reader.onload = () => {
      const objs = Store.csvToObjects(reader.result);
      if (tipo === "disc") state.disciplinas = Store.normalizeDisciplinas(objs);
      else state.professores = Store.normalizeProfessores(objs);
      state.dirty.clear();
      setStatus("local (CSV)", "ro");
      refreshChrome();
      render();
      toast(`${tipo === "disc" ? "Disciplinas" : "Professores"} importados (${objs.length}).`, "ok");
    };
    reader.readAsText(file, "utf-8");
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, type) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (type ? " " + type : "");
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 3200);
  }

  // ---------- Tema ----------
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }
  function toggleTheme() {
    const cur = localStorage.getItem(LS_THEME) || "auto";
    const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
    localStorage.setItem(LS_THEME, next);
    applyTheme(next);
    toast("Tema: " + next, "");
  }

  // ---------- Wiring ----------
  function init() {
    applyTheme(localStorage.getItem(LS_THEME) || "auto");

    document.querySelectorAll(".tab").forEach((b) => {
      b.onclick = () => {
        state.tab = b.dataset.tab;
        setActiveTab(state.tab);
        render();
      };
    });

    $("#btn-reload").onclick = carregar;
    $("#btn-save").onclick = salvar;
    $("#btn-config").onclick = openConfig;
    $("#btn-theme").onclick = toggleTheme;
    $("#cfg-cancel").onclick = closeConfig;
    $("#cfg-save").onclick = () => {
      Store.setConfig($("#cfg-endpoint").value, $("#cfg-token").value);
      closeConfig();
      refreshChrome();
      if (Store.getConfig().endpoint) carregar();
    };
    $("#config-modal").onclick = (e) => {
      if (e.target.id === "config-modal") closeConfig();
    };
    $("#file-disc").onchange = (e) => e.target.files[0] && importarCSV(e.target.files[0], "disc");
    $("#file-prof").onchange = (e) => e.target.files[0] && importarCSV(e.target.files[0], "prof");

    // Export menu
    const menu = $("#export-menu");
    $("#btn-export").onclick = (e) => {
      const r = e.target.getBoundingClientRect();
      menu.style.top = r.bottom + 6 + "px";
      menu.style.right = window.innerWidth - r.right + "px";
      menu.classList.toggle("hidden");
    };
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target.id !== "btn-export") menu.classList.add("hidden");
    });
    menu.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        menu.classList.add("hidden");
        if (!state.disciplinas.length) return toast("Nada para exportar.", "err");
        const exp = b.dataset.exp;
        if (exp === "xlsx") Exporter.exportarXlsx(state.disciplinas, state.professores, "Encargos.xlsx");
        else if (exp === "csv") Exporter.exportarCsv(state.disciplinas, "disciplinas.csv");
        else if (exp === "pdf") Exporter.exportarPdf();
      };
    });

    refreshChrome();
    if (Store.getConfig().endpoint) carregar();
    else render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
