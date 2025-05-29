import pandas as pd
from itertools import combinations
import altair as alt

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

    pausas = ['11:30', '12:00', '12:30', '13:00', '17:30']
    for hora in pausas:
        if hora in schedule.index:
            schedule.loc[hora] = -1

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
   

    # Conflitos: células com mais de uma disciplina
    conflitos = {
        (dia, hora): disciplinas
        for (dia, hora), disciplinas in disciplinas_map.items()
        if len(set(disciplinas)) > 1
    }

    registros = []
    for (dia, hora), disciplinas in conflitos.items():
        registros.append({
            "Dia": dia,
            "Hora": hora,
            "Nº Disciplinas": len(set(disciplinas)),
            "Disciplinas": ", ".join(sorted(set(disciplinas)))
        })

    return schedule, registros, disciplinas_map, False


def plot_matriz_conflitos(df):
    # Garante colunas esperadas
    df = df[['Ordem', 'Disciplina', 'Horario']].dropna(subset=["Disciplina", "Horario"])
    df = df.drop_duplicates(subset=["Ordem"])

    # Mapeia código da disciplina (Ordem) → blocos de horário
    def blocos_ocupados(horario_str):
        blocos = set()
        for bloco in str(horario_str).split("/"):
            blocos.update(decode_schedule(bloco.strip()))
        return blocos

    ordem_to_blocos = {
        row["Ordem"]: blocos_ocupados(row["Horario"])
        for _, row in df.iterrows()
    }

    ordem_to_nome = dict(zip(df["Ordem"], df["Disciplina"]))
    codigos = list(ordem_to_blocos.keys())

    # Gera matriz de conflitos
    result = []
    for o1, o2 in combinations(codigos, 2):
        intersecao = ordem_to_blocos[o1].intersection(ordem_to_blocos[o2])
        conflito = int(len(intersecao) > 0)
        result.append({
            "Ordem 1": o1, "Ordem 2": o2, "Conflito": conflito,
            "Disciplina 1": ordem_to_nome[o1],
            "Disciplina 2": ordem_to_nome[o2]
        })
        result.append({
            "Ordem 1": o2, "Ordem 2": o1, "Conflito": conflito,
            "Disciplina 1": ordem_to_nome[o2],
            "Disciplina 2": ordem_to_nome[o1]
        })

    # Diagonal (sem conflito)
    for o in codigos:
        result.append({
            "Ordem 1": o, "Ordem 2": o, "Conflito": 0,
            "Disciplina 1": ordem_to_nome[o],
            "Disciplina 2": ordem_to_nome[o]
        })

    df_conflito = pd.DataFrame(result)

    # Cria gráfico Altair
    chart = alt.Chart(df_conflito).mark_rect().encode(
        x=alt.X('Ordem 1:N', sort=codigos, title=None),
        y=alt.Y('Ordem 2:N', sort=codigos, title=None),
        color=alt.Color(
            'Conflito:O',
            scale=alt.Scale(domain=[0, 1], range=["#07519b", "#ff4d4d"]),
            legend=None
        ),
        tooltip=[
            # alt.Tooltip('Ordem 1:N', title="Código 1"),
            alt.Tooltip('Disciplina 1:N'),
            # alt.Tooltip('Ordem 2:N', title="Código 2"),
            alt.Tooltip('Disciplina 2:N'),
            alt.Tooltip('Conflito:O', title="Conflito")
        ]
    ).properties(
        width=500,
        height=500,
        title="Matriz de Conflitos entre Disciplinas"
    ).configure_axis(
        labelFontSize=11,
        labelAngle=0
    )

    return chart, df_conflito


def disciplinas_livres_professor(df_conflito, df_disciplinas, professor):
    # 1. Identifica os códigos atribuídos ao professor atual
    atribuídas = df_disciplinas[df_disciplinas["Professor(a)"] == professor]["Ordem"].unique().tolist()

    # 2. Identifica disciplinas em conflito com as atribuídas
    conflitos_com_atribuídas = df_conflito[
        (df_conflito["Ordem 1"].isin(atribuídas)) &
        (df_conflito["Conflito"] == 1)
    ]["Ordem 2"].unique().tolist()

    # 3. Seleciona disciplinas ainda não atribuídas a nenhum professor
    nao_atribuidas = df_disciplinas[
        df_disciplinas["Professor(a)"].isna() | (df_disciplinas["Professor(a)"].astype(str).str.strip() == "")
    ]

    # 4. Códigos candidatos (não atribuídas + sem conflito)
    livres = nao_atribuidas[
        ~nao_atribuidas["Ordem"].isin(atribuídas + conflitos_com_atribuídas)
    ][["Ordem", "Disciplina"]].drop_duplicates()

    return livres.sort_values("Ordem").reset_index(drop=True)


def build_schedule_from_dataframe(df):
    schedule = pd.DataFrame(0, index=time_slots, columns=DAYS)
    disciplinas_map = { (dia, hora): [] for dia in DAYS for hora in time_slots }

    pausas = ['11:30', '12:00', '12:30', '13:00', '17:30']
    for hora in pausas:
        if hora in schedule.index:
            schedule.loc[hora] = -1

    df_prof = df.copy()

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
   

    # Conflitos: células com mais de uma disciplina
    conflitos = {
        (dia, hora): disciplinas
        for (dia, hora), disciplinas in disciplinas_map.items()
        if len(set(disciplinas)) > 1
    }

    registros = []
    for (dia, hora), disciplinas in conflitos.items():
        registros.append({
            "Dia": dia,
            "Hora": hora,
            "Nº Disciplinas": len(set(disciplinas)),
            "Disciplinas": ", ".join(sorted(set(disciplinas)))
        })

    return schedule, registros, disciplinas_map, False


def plot_schedule_altair(schedule_df, conflitos, disciplinas_map, professor_name):
    df = schedule_df.reset_index().melt(id_vars='index', var_name='Dia', value_name='Aulas')
    df.columns = ['Hora', 'Dia', 'Aulas']
    df['Aulas'] = df['Aulas'].fillna(0).astype(int)

    # Mostra todas as disciplinas da célula, mesmo se for só uma
    df['DisciplinasNaCelula'] = df.apply(
        lambda row: ", ".join(sorted(set(disciplinas_map.get((row['Dia'], row['Hora']), [])))),
        axis=1
    )

    df['TemConflito'] = df.apply(
        lambda row: (row['Dia'], row['Hora']) in conflitos,
        axis=1
    )

    chart = alt.Chart(df).mark_rect(stroke='#efefef',  # Borda cinza clara para melhor visualização
        strokeWidth=0.5).encode(
        y=alt.Y('Hora:O', sort=schedule_df.index, title=None),
        x=alt.X('Dia:O', sort=DAYS, title=None, axis=alt.Axis(labelAngle=0, orient='top')),
        color=alt.Color(
            'Aulas:O',
            scale=alt.Scale(
                range=["#9c9c9c", "#ffffff", "#07519b", "#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404","#7d0404"],
                domain=[-1, 0, 1, 2,3,4,5,6,7,8,9,10,11,12,13,14,15]
            ),
            legend=None
        ),
        tooltip=[
            alt.Tooltip('Dia:N'),
            alt.Tooltip('Hora:N'),
            # alt.Tooltip('Aulas:Q', title='Total de Aulas'),
            alt.Tooltip('DisciplinasNaCelula:N', title='Disciplinas')
        ]
    ).properties(
        # title=f'Horário de {professor_name}',
        # width=700,
        height=300
    ).configure_view(
        stroke='transparent',
        fill='#ffffff'
    ).configure(
        background='#ffffff'
    ).configure_axis(
        grid=False,
        domain=False,
        labelFontSize=12
    ).configure_title(
        fontSize=18,
        anchor='start'
    )

    return chart