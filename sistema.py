import streamlit as st
from streamlit_autorefresh import st_autorefresh
import pandas as pd
import os
from datetime import datetime
import altair as alt

from componente import DAYS, build_schedule_with_conflicts

now = datetime.now()
ano_atual = now.year
semestre_atual = 1 if now.month <= 6 else 2


DATA_DIR = "data"


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
                range=["#ededed", "#ffffff", "#3399ff", "#ff4d4d"],
                domain=[-1, 0, 1, 2]
            ),
            legend=None
        ),
        tooltip=[
            alt.Tooltip('Dia:N'),
            alt.Tooltip('Hora:N'),
            alt.Tooltip('Aulas:Q', title='Total de Aulas'),
            alt.Tooltip('DisciplinasNaCelula:N', title='Disciplinas')
        ]
    ).properties(
        title=f'Horário de {professor_name}',
        # width=700,
        height=400
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

def load_dados():
    professores = pd.read_csv(os.path.join(DATA_DIR, f"professores_{st.session_state['semestre']}.csv"))
    disciplinas = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
    st.session_state['professores'] = professores
    st.session_state['disciplinas'] = disciplinas
    return disciplinas,professores
   


def salvar_registro(ano, semestre, disciplinas, professores):
    nome = f"{ano}_{semestre}"
    novo_nome_dis = f"disciplinas_{nome}.csv"
    novo_nome_prof = f"professores_{nome}.csv"
    caminho_final_dis = os.path.join(DATA_DIR, novo_nome_dis)
    caminho_final_prof = os.path.join(DATA_DIR, novo_nome_prof)

    # Salvar CSV no local
    professores.to_csv(caminho_final_prof, index=False)
    disciplinas.to_csv(caminho_final_dis, index=False)
    st.session_state.pop('disciplinas', None)
    st.session_state.pop('professores', None)
    pass

def alocadisciplina():
    dis =  st.session_state['disciplina']
    prof =  st.session_state['professor']
    disciplinas = st.session_state['disciplinas']
    print(dis)
    if dis and  prof:
        disciplinas.loc[disciplinas['Ordem'] == dis[0], "Professor(a)"]=prof
        disciplinas.to_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"), index=False)

def desalocadisciplina():
    disciplinas = st.session_state['disciplinas']
    prof =  st.session_state['professor']
    disprof = disciplinas[disciplinas["Professor(a)"]==prof]
    for index,row in disprof.iterrows():
        key = f"checkbox_{row['Ordem']}"
        estado = st.session_state.get(key)
        if not estado:
            disciplinas.loc[disciplinas['Ordem'] == row['Ordem'], "Professor(a)"]=None
            disciplinas.to_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"), index=False)
            

def on_click_callback(x):
    """Função de callback para o botão 'Acompanhar distribuição'."""
    # print("chamaou a função")
    st.session_state["page"] = x

def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)

def run():
    """Função principal para executar o sistema."""
    # Carrega o CSS
    load_css("./assets/css/styles.css")


    # Sidebar com informações do usuário
    lgcont = st.sidebar.container(border=True)
    user_picture = st.user.picture
    user_name = st.user.name
    lgcont.markdown(
        f""" <div class="user-container">
        <img src="{user_picture}" class="rounded-img">
        <span class="user-text">Olá, {user_name}!</span>
    </div>
    """,
        unsafe_allow_html=True
    )
    if lgcont.button("Sair", use_container_width=True):
        st.logout()
    
    if st.session_state['page']=="home":
        load_css("./assets/css/styles.css")
        st.markdown("""<div class="title-text">Aplicativo de distribuição de disciplinas - DEMAT - UFMT</div>""", unsafe_allow_html=True)
        col1, col2, col3 = st.columns([0.3, 0.4, 0.3])
        with col2:
            st.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
            
            st.button("Acompanhar distribuição", use_container_width=True, on_click=on_click_callback,args=("acompanhamento",))
            st.button("Inserir dados", use_container_width=True, on_click=on_click_callback,args=("inserir_dados",))
            st.button("Sistema de atribuição", use_container_width=True, on_click=on_click_callback,args=("sistema",))

    if st.session_state['page']=="inserir_dados":
        col1, col2 = st.columns([0.9,0.1],vertical_alignment="top")
        col1.markdown("""
            <style>
            .st-emotion-cache-1wvkpev{
                border: 0px solid #000;
                    }
            </style>
            <div class="title-text-wrapper-left">
                <div class="title-text">Insira dados das disciplinas e lista de professores - DEMAT - UFMT</div>
            </div>
        """, unsafe_allow_html=True)
        
        # col1.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
        col2.button(":material/arrow_back:", use_container_width=True, on_click=lambda: st.session_state.update({"page": "home"}),key='teste')
        st.markdown('<div class="v-space"></div>', unsafe_allow_html=True)

        cols1, cols2 = st.columns([0.5, 0.5])
        ano = cols1.number_input("Ano:", min_value=2020, max_value=2100, value=ano_atual, key='ano')
        semestre = cols2.number_input("Semestre:", min_value=1, max_value=2, value=semestre_atual,key='semestre')

        uploaded_disciplinas = cols1.file_uploader("Planilha de disciplinas:", type=["csv"],key = 'disciplinas')
        uploaded_professores = cols2.file_uploader("Planilha de professores:", type=["csv"], key = 'professores')
        
        nome = f"{ano}_{semestre}"
        if uploaded_disciplinas and nome and uploaded_professores:
            professores = pd.read_csv(uploaded_professores)
            disciplinas = pd.read_csv(uploaded_disciplinas)
            cols1.markdown(f"**Planilha de disciplinas:** {uploaded_disciplinas.name}")
            cols2.markdown(f"**Planilha de professores:** {uploaded_professores.name}")
            cols1.dataframe(disciplinas,hide_index=True)
            cols2.dataframe(professores,hide_index=True)
            st.button("Salvar", use_container_width=True, on_click=salvar_registro, args=(ano, semestre, disciplinas, professores), key='salvar')
            
        
    if st.session_state['page']=="sistema":
        semestres = ["_".join(x.split("_")[1:]).split(".")[0]  for x in os.listdir(DATA_DIR) if x.endswith(".csv")]
        st.sidebar.selectbox("Selecione o semestre:", set(semestres), key='semestre', on_change = load_dados,index=0)
        disciplinas,professores = load_dados()
        st.session_state['professores'] = professores
        st.session_state['disciplinas'] = disciplinas
        col1, col2 = st.columns([0.9,0.1],vertical_alignment="top")
        st.markdown("""
            <style>
            .st-emotion-cache-1wvkpev{
                border: 0px solid #000;
                    }
            </style>
        """, unsafe_allow_html=True)
        col1.markdown(f"""
            <div class="title-text-wrapper-left">
                <div class="title-text">Atribuição de disciplinas - {"/".join(st.session_state['semestre'].split("_"))}</div>
            </div>
        """, unsafe_allow_html=True)
        
        col2.button(":material/arrow_back:", use_container_width=True, on_click=lambda: st.session_state.update({"page": "home"}),key='teste')
        
        if not disciplinas.empty and not professores.empty:
            cols1,cols2,cols3 = st.columns(3)
            cont1 = cols1.container(border=True,height=500)
            cont2 = cols2.container(border=True,height=500)
            cont3 = cols3.container(border=True,height=500)
            colunas = disciplinas.columns.tolist()
            cont1.markdown(f"**Professores do DMAT**")
            cont1.radio("Selecione o professor:", options=professores["Docentes"].tolist(), key='professor',label_visibility="collapsed")
            cont2.markdown(f"**Atribuição de disciplinas**")
            disciplinas_livres = disciplinas[disciplinas[colunas[-1]].isna()]
            
            dis_sel = None
            if not disciplinas_livres.empty:
                index_dix = cont2.selectbox("Selecione a disciplina:", options=list(range(len(disciplinas_livres))), index=None, placeholder="Selecione uma disciplina", key='dis',label_visibility="collapsed", format_func=lambda x: f'{disciplinas_livres.iloc[x,0]} - {disciplinas_livres.iloc[x,2]}')
                if isinstance(index_dix, int):
                    st.session_state['disciplina'] = [int(disciplinas_livres.iloc[index_dix,0]),disciplinas_livres.iloc[index_dix,2]]
                    dis_sel = disciplinas[disciplinas['Ordem'] == int(disciplinas_livres.iloc[index_dix,0])].iloc[0].to_dict()
                else:
                    st.session_state['disciplina'] = None 
            
            cont2.markdown(f"**Atribuidas ao professor**") 
            profdis = disciplinas[disciplinas[colunas[-1]]==st.session_state['professor']]
            if not profdis.empty:
                # cont2.dataframe(profdis, use_container_width=True, hide_index=True)
                for index, row in profdis.iterrows():
                    cont2.checkbox(f"{row['Ordem']} - {row[colunas[2]]}", value=True, key=f"checkbox_{row['Ordem']}",on_change=desalocadisciplina)
            else:
                cont2.markdown("Nenhuma disciplina atribuída ao professor.")
            cont2.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
            cont2.button("Atribuir", use_container_width=True, on_click = alocadisciplina)

            grade, conflitos,mapa, vazio = build_schedule_with_conflicts(disciplinas, st.session_state['professor'],dis_sel)
            
            cont3.altair_chart(plot_schedule_altair(grade,conflitos,mapa, st.session_state['professor']), use_container_width=True)
            
            if len(conflitos):
                cont3.markdown(f"**Conflitos de horários**")
                cont3.dataframe(conflitos)

            st.dataframe(disciplinas, use_container_width=True, hide_index=True,height=500)

    if st.session_state['page']=="acompanhamento":
        
        load_css("./assets/css/styles.css")
        st_autorefresh(interval=5 * 1000, key="data_refresh")
        col1, col2 = st.columns([0.9,0.1],vertical_alignment="top")
        col1.markdown("""
            <style>
            .st-emotion-cache-1wvkpev{
                border: 0px solid #000;
                    }
            </style>
            <div class="title-text-wrapper-left">
                <div class="title-text">Planilha de distribuição de disciplinas - DEMAT - UFMT</div>
            </div>
        """, unsafe_allow_html=True)
        
        # col1.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
        col2.button(":material/arrow_back:", use_container_width=True, on_click=lambda: st.session_state.update({"page": "home"}),key='teste')
        st.markdown('<div class="v-space"></div>', unsafe_allow_html=True)
        planilha = pd.read_csv("data/tabela.csv")
        st.dataframe(planilha, use_container_width=True, hide_index=True, height=500)