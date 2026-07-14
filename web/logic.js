/*
 * logic.js — porte da lógica de horários e conflitos de componente.py
 * (parsing do código "Horario", grade por professor, detecção de conflitos).
 * Sem dependências. Exposto em window.Logic.
 */
(function () {
  "use strict";

  const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const START_HOUR = 7;
  const END_HOUR = 23;
  const PAUSAS = ["11:30", "12:00", "12:30", "13:00", "17:30"];

  const DAY_MAP = { "2": "Seg", "3": "Ter", "4": "Qua", "5": "Qui", "6": "Sex" };

  // Gera os slots de 30min: "07:30", "08:00", ... "23:00"
  function generateTimeSlots(start = START_HOUR, end = END_HOUR) {
    const times = [];
    for (let hour = start; hour < end; hour++) {
      times.push(String(hour).padStart(2, "0") + ":30");
      times.push(String(hour + 1).padStart(2, "0") + ":00");
    }
    return times;
  }

  const TIME_SLOTS = generateTimeSlots();

  // Decodifica um bloco de 5 chars (ex.: "21532") em pares [dia, hora].
  function decodeSchedule(code) {
    if (!code) return [];
    code = String(code).trim();
    const diaCod = code[0];
    if (!(diaCod in DAY_MAP)) return []; // sábado/inválido → ignora
    const day = DAY_MAP[diaCod];
    const hour = parseInt(code.slice(1, 3), 10);
    const minute = parseInt(code[3], 10) * 10; // ex.: 3 → 30
    const duration = parseInt(code[4], 10); // horas-aula (1h = 2 blocos de 30min)
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(duration)) {
      return [];
    }
    const startTime = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    const startIndex = TIME_SLOTS.indexOf(startTime);
    if (startIndex < 0) return [];
    const out = [];
    for (let i = 0; i < duration * 2; i++) {
      const slot = TIME_SLOTS[startIndex + i];
      if (slot) out.push([day, slot]);
    }
    return out;
  }

  // Conjunto de blocos (dia|hora) ocupados por uma string "Horario".
  function blocosOcupados(horarioStr) {
    const blocos = new Set();
    if (!horarioStr) return blocos;
    for (const bloco of String(horarioStr).split("/")) {
      for (const [dia, hora] of decodeSchedule(bloco.trim())) {
        blocos.add(dia + "|" + hora);
      }
    }
    return blocos;
  }

  // Duas disciplinas conflitam se compartilham ao menos um bloco.
  function conflita(horarioA, horarioB) {
    const a = blocosOcupados(horarioA);
    const b = blocosOcupados(horarioB);
    for (const x of a) if (b.has(x)) return true;
    return false;
  }

  // Grade do professor: matriz {hora}{dia} = contagem; pausas = -1.
  // Retorna { grid, mapa, conflitos } onde mapa[dia|hora] = [disciplinas],
  // conflitos = [{dia,hora,n,disciplinas}].
  function buildSchedule(disciplinasDoProf, simulada) {
    const grid = {};
    const mapa = {};
    for (const hora of TIME_SLOTS) {
      grid[hora] = {};
      for (const dia of DAYS) {
        grid[hora][dia] = PAUSAS.includes(hora) ? -1 : 0;
        mapa[dia + "|" + hora] = [];
      }
    }

    const rows = disciplinasDoProf.slice();
    if (simulada && simulada.Horario) rows.push(simulada);

    for (const row of rows) {
      const disciplina = row.Disciplina || "Desconhecida";
      for (const bloco of String(row.Horario || "").split("/")) {
        for (const [dia, hora] of decodeSchedule(bloco.trim())) {
          if (grid[hora] && dia in grid[hora]) {
            if (grid[hora][dia] < 0) grid[hora][dia] = 0; // sai da pausa se houver aula
            grid[hora][dia] += 1;
            mapa[dia + "|" + hora].push(disciplina);
          }
        }
      }
    }

    const conflitos = [];
    for (const key of Object.keys(mapa)) {
      const nomes = mapa[key];
      const unicos = Array.from(new Set(nomes));
      if (unicos.length > 1) {
        const [dia, hora] = key.split("|");
        conflitos.push({ dia, hora, n: unicos.length, disciplinas: unicos.sort() });
      }
    }
    return { grid, mapa, conflitos };
  }

  // Matriz N×N de conflitos entre disciplinas (com horário definido).
  // Retorna { ordens, nomes, matriz } — matriz[i][j] = true se conflitam.
  function matrizConflitos(disciplinas) {
    const items = disciplinas.filter((d) => d.Disciplina && d.Horario);
    const ordens = items.map((d) => d.Ordem);
    const nomes = {};
    const blocos = {};
    for (const d of items) {
      nomes[d.Ordem] = d.Disciplina;
      blocos[d.Ordem] = blocosOcupados(d.Horario);
    }
    const matriz = {};
    for (const a of ordens) {
      matriz[a] = {};
      for (const b of ordens) {
        if (a === b) {
          matriz[a][b] = false;
          continue;
        }
        let conflita = false;
        for (const x of blocos[a]) {
          if (blocos[b].has(x)) {
            conflita = true;
            break;
          }
        }
        matriz[a][b] = conflita;
      }
    }
    return { ordens, nomes, matriz };
  }

  // Disciplinas livres que NÃO conflitam com nenhuma já atribuída ao professor.
  function disciplinasLivresSemConflito(disciplinas, professor) {
    const atribuidasProf = disciplinas.filter((d) => (d["Professor(a)"] || "") === professor);
    const blocosProf = atribuidasProf.map((d) => blocosOcupados(d.Horario));
    const livres = disciplinas.filter((d) => !(d["Professor(a)"] || "").trim());
    return livres.filter((d) => {
      const b = blocosOcupados(d.Horario);
      for (const bset of blocosProf) {
        for (const x of b) if (bset.has(x)) return false;
      }
      return true;
    });
  }

  window.Logic = {
    DAYS,
    TIME_SLOTS,
    PAUSAS,
    decodeSchedule,
    blocosOcupados,
    conflita,
    buildSchedule,
    matrizConflitos,
    disciplinasLivresSemConflito,
  };
})();
