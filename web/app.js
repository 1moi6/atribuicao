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
    idToken: null,
    userEmail: "",
    userName: "",
    isEditor: false,
  };

  // Abas visíveis no modo somente leitura (as demais são só para editores).
  const VIEWER_TABS = new Set(["grade", "distribuicao"]);

  const GOOGLE_G_SVG =
    '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    "</svg>";

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
  let lastSig = "";
  function sigOf(disc) {
    return disc.length + "#" + disc.map((d) => d.Ordem + ":" + (d["Professor(a)"] || "")).join("|");
  }

  // carregar(silent): silent=true é a atualização automática (acompanhamento
  // ao vivo) — não interrompe quem está editando e só re-renderiza se mudou.
  async function carregar(silent) {
    if (!silent) setStatus("…", "");
    try {
      const data = await Store.fetchFromSheet();
      if (silent && state.dirty.size) return; // não atropela edição em andamento
      const sig = sigOf(data.disciplinas);
      const changed = sig !== lastSig;
      if (silent && !changed) return; // nada novo salvo na planilha
      state.disciplinas = data.disciplinas;
      state.professores = data.professores;
      lastSig = sig;
      state.dirty.clear();
      refreshChrome();
      render();
      if (!silent) toast("Dados carregados do Drive.", "ok");
      else toast("Distribuição atualizada.", "");
    } catch (e) {
      if (!silent) {
        setStatus("offline", "err");
        toast("Não foi possível carregar: " + e.message, "err");
        render();
      }
    }
  }

  // Acompanhamento ao vivo: puxa a planilha periodicamente. Pausa quando há
  // edição pendente, quando a aba está oculta ou um modal está aberto.
  const REFRESH_MS = 30000;
  function startAutoRefresh() {
    setInterval(() => {
      if (!Store.getConfig().endpoint) return;
      if (document.hidden) return;
      if (state.dirty.size) return;
      carregar(true);
    }, REFRESH_MS);
  }

  async function salvar() {
    if (!state.dirty.size) return toast("Nada a salvar.", "");
    if (!state.isEditor) return toast("Faça login com uma conta autorizada para salvar.", "err");
    const assignments = Array.from(state.dirty).map((ordem) => ({
      ordem,
      professor: (discPorOrdem(ordem)["Professor(a)"] || ""),
    }));
    $("#btn-save").disabled = true;
    try {
      await Store.saveAssignments(assignments, state.idToken);
      state.dirty.clear();
      refreshChrome();
      toast("Atribuições salvas no Drive.", "ok");
    } catch (e) {
      toast("Falha ao salvar: " + e.message + " (se o login expirou, entre novamente)", "err");
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
    state.readOnly = !state.isEditor;
    const dc = $("#dirty-count");
    dc.textContent = state.dirty.size;
    dc.classList.toggle("hidden", state.dirty.size === 0);
    $("#btn-save").classList.toggle("hidden", !state.isEditor);

    // No modo leitura, viewers só acompanham Grade e Distribuição.
    document.querySelectorAll(".tab").forEach((t) => {
      const editorOnly = !VIEWER_TABS.has(t.dataset.tab);
      t.classList.toggle("hidden", editorOnly && !state.isEditor);
    });
    if (!state.isEditor && !VIEWER_TABS.has(state.tab)) {
      state.tab = "distribuicao";
      setActiveTab(state.tab);
    }

    if (state.disciplinas.length) {
      setStatus(state.isEditor ? "editor" : "somente leitura", state.isEditor ? "ok" : "ro");
    }
    $("#semestre-label").textContent = "";
  }

  // ---------- Render dispatcher ----------
  function render() {
    const view = $("#view");
    view.innerHTML = "";
    if (!state.disciplinas.length) return renderEmpty(view);
    // Salvaguarda: fora as abas de leitura, o resto é só para editores.
    if (!state.isEditor && !VIEWER_TABS.has(state.tab)) state.tab = "distribuicao";
    ({
      atribuicao: renderAtribuicao,
      grade: renderGrade,
      conflitos: renderConflitos,
      dashboard: renderDashboard,
      distribuicao: renderDistribuicao,
    }[state.tab] || renderDistribuicao)(view);
  }

  function renderEmpty(view) {
    const c = el("div", "empty-state");
    c.innerHTML =
      '<div class="big">📚</div><h2>Nenhum dado carregado</h2>' +
      '<p class="muted">Não foi possível ler a planilha agora. Verifique a conexão e tente novamente.</p>';
    const b = el("button", "btn btn-primary", "Recarregar");
    b.onclick = () => carregar();
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
    bar.style.marginBottom = "14px";
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

    // Seletor de disciplina para simular/checar choque com a grade do professor.
    bar.appendChild(el("label", null, "Simular disciplina:"));
    const dsel = el("select");
    dsel.style.maxWidth = "340px";
    dsel.innerHTML =
      '<option value="">— nenhuma —</option>' +
      state.disciplinas
        .slice()
        .sort((a, b) => a.Ordem - b.Ordem)
        .map(
          (d) =>
            `<option value="${d.Ordem}" ${state.selDiscOrdem === d.Ordem ? "selected" : ""}>${d.Ordem} - ${esc(d.Disciplina)}</option>`
        )
        .join("");
    dsel.onchange = () => {
      state.selDiscOrdem = dsel.value ? Number(dsel.value) : null;
      render();
    };
    bar.appendChild(dsel);
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

    // Resumo do choque da disciplina simulada com a grade atual do professor.
    if (state.selDiscOrdem) {
      const d = discPorOrdem(state.selDiscOrdem);
      const box = el("div", "row");
      box.style.marginBottom = "12px";
      if (d && (d["Professor(a)"] || "") === state.selProf) {
        box.appendChild(el("span", "tag ok", "Já atribuída a este professor — " + esc(d.Disciplina)));
      } else if (d) {
        const profBlocks = new Set();
        disciplinasDoProf(state.selProf).forEach((x) =>
          Logic.blocosOcupados(x.Horario).forEach((b) => profBlocks.add(b))
        );
        const choque = [...Logic.blocosOcupados(d.Horario)].some((b) => profBlocks.has(b));
        box.appendChild(
          el(
            "span",
            "tag " + (choque ? "conf" : "ok"),
            (choque ? "⚠ Choque de horário" : "✓ Sem choque") + " — " + esc(d.Disciplina)
          )
        );
      }
      card.appendChild(box);
    }

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

  // ---------- Login Google (GIS) ----------
  function decodeJwt(t) {
    try {
      const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) {
      return {};
    }
  }

  function whenGoogleReady(cb, tries) {
    tries = tries || 0;
    if (window.google && google.accounts && google.accounts.id) return cb();
    if (tries > 60) return; // ~6s
    setTimeout(() => whenGoogleReady(cb, tries + 1), 100);
  }

  function initGoogleSignIn() {
    const { clientId } = Store.getConfig();
    const btn = $("#gsi-btn");
    btn.innerHTML = "";
    if (!clientId) return;
    whenGoogleReady(() => {
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: onGoogleCredential,
          use_fedcm_for_prompt: true,
        });
        // Botão próprio "G Login" — o botão oficial do Google não permite rótulo livre.
        const b = el("button", "btn login-btn");
        b.innerHTML = GOOGLE_G_SVG + "<span>Login</span>";
        b.onclick = () =>
          google.accounts.id.prompt((n) => {
            if (n.isNotDisplayed() || n.isSkippedMoment()) {
              toast("Não foi possível abrir o login do Google. Tente novamente.", "err");
            }
          });
        btn.appendChild(b);
      } catch (e) {
        toast("Falha ao iniciar o login Google: " + e.message, "err");
      }
    });
  }

  async function onGoogleCredential(resp) {
    state.idToken = resp.credential;
    const p = decodeJwt(resp.credential);
    state.userEmail = p.email || "";
    state.userName = p.given_name || (p.name ? p.name.split(" ")[0] : "") || state.userEmail;
    state.isEditor = false;
    try {
      if (Store.getConfig().endpoint) {
        const who = await Store.whoami(state.idToken);
        state.userEmail = who.email || state.userEmail;
        state.isEditor = who.canWrite;
      }
    } catch (e) {
      toast("Login: " + e.message, "err");
    }
    updateAuthUI();
    refreshChrome();
    render();
    toast(
      (state.isEditor ? "Editor: " : "Somente leitura: ") + (state.userName || state.userEmail),
      state.isEditor ? "ok" : ""
    );
  }

  function logout() {
    state.idToken = null;
    state.userEmail = "";
    state.userName = "";
    state.isEditor = false;
    try {
      google.accounts.id.disableAutoSelect();
    } catch (e) {}
    updateAuthUI();
    refreshChrome();
    render();
  }

  function updateAuthUI() {
    const signed = !!state.idToken;
    $("#gsi-btn").classList.toggle("hidden", signed);
    $("#user-chip").classList.toggle("hidden", !signed);
    $("#user-email").textContent = (state.userName || state.userEmail) + (state.isEditor ? " · editor" : " · leitura");
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
    $("#btn-theme").onclick = toggleTheme;
    $("#btn-logout").onclick = logout;

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

    updateAuthUI();
    initGoogleSignIn();
    refreshChrome();
    if (Store.getConfig().endpoint) carregar();
    else render();
    startAutoRefresh();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
