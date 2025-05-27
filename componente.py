import pandas as pd

# Dias da semana sem sábado
DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
START_HOUR = 7
END_HOUR = 23

# Gera os horários como strings "HH:MM", começando em 07:30
def generate_time_slots(start_hour=START_HOUR, end_hour=END_HOUR):
    times = []
    for hour in range(start_hour, end_hour):
        times.append(f"{hour:02d}:30")
        times.append(f"{hour+1:02d}:00")
    return times

time_slots = generate_time_slots()

# Codificação fornecida: 2=segunda, 3=terça, ..., 6=sexta
def decode_schedule(code):
    day_map = {
        '2': 'Seg',
        '3': 'Ter',
        '4': 'Qua',
        '5': 'Qui',
        '6': 'Sex'
    }

    try:
        dia_cod = code[0]
        if dia_cod not in day_map:
            return []  # ignora se for sábado ou inválido

        day = day_map[dia_cod]
        hour = int(code[1:3])
        minute = int(code[3]) * 10  # ex: 3 → 30
        duration = int(code[4])     # em horas de aula (1h = 2 blocos de 30min)

        start_time = f"{hour:02d}:{minute:02d}"
        start_index = time_slots.index(start_time)

        return [(day, time_slots[start_index + i]) for i in range(duration * 2)]
    except Exception:
        return []

# Gera a grade de um professor
def build_schedule_for_professor(df, professor_name):
    schedule = pd.DataFrame(0, index=time_slots, columns=DAYS)

    df_prof = df[df["Professor(a)"] == professor_name]
    if df_prof.empty:
        return schedule, True

    for horarios in df_prof["Horario"].dropna():
        for bloco in horarios.split("/"):
            for dia, horario in decode_schedule(bloco.strip()):
                if dia in schedule.columns and horario in schedule.index:
                    schedule.loc[horario, dia] += 1

    return schedule, False


def build_schedule_with_conflicts(df, professor_name, disciplina_simulada=None):
    schedule = pd.DataFrame(0, index=time_slots, columns=DAYS)
    disciplinas_map = { (dia, hora): [] for dia in DAYS for hora in time_slots }

    df_prof = df[df["Professor(a)"] == professor_name].copy()

    # Se for simular uma nova disciplina, adiciona uma linha fictícia
    if disciplina_simulada is not None:
        simulated_row = {
            "Professor(a)": professor_name,
            "Disciplina": disciplina_simulada.get("Disciplina", "Desconhecida"),
            "Horario": disciplina_simulada.get("Horario", "")
        }
        df_prof = pd.concat([df_prof, pd.DataFrame([simulated_row])], ignore_index=True)

    if df_prof.empty:
        return schedule, {}, {}, True

    for _, row in df_prof.iterrows():
        disciplina = row.get("Disciplina", "Desconhecida")
        horarios = row.get("Horario", "")
        for bloco in str(horarios).split("/"):
            for dia, horario in decode_schedule(bloco.strip()):
                if dia in schedule.columns and horario in schedule.index:
                    schedule.loc[horario, dia] += 1
                    disciplinas_map[(dia, horario)].append(disciplina)

    # Define os horários de pausa como -1
    pausas = ['11:30', '12:00', '12:30', '13:00', '17:30']
    for hora in pausas:
        if hora in schedule.index:
            schedule.loc[hora] = -1

    # Conflitos: células com mais de uma disciplina
    conflitos = {
        (dia, hora): disciplinas
        for (dia, hora), disciplinas in disciplinas_map.items()
        if len(set(disciplinas)) > 1
    }

    return schedule, conflitos, disciplinas_map, False
