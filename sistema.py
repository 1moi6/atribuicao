import streamlit as st
from streamlit_autorefresh import st_autorefresh
import pandas as pd
import json
import os
# st.set_page_config(page_title="Otimizando a distribuição", page_icon="./assets/images/ialogo2.png")

from datetime import datetime
now = datetime.now()
ano_atual = now.year
semestre_atual = 1 if now.month <= 6 else 2


DATA_DIR = "data"

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



def on_click_callback(x):
    """Função de callback para o botão 'Acompanhar distribuição'."""
    print("chamaou a função")
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
        st.sidebar.selectbox("Selecione o semestre:", set(semestres), key='semestre')
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
        
        cols1,cols2,cols3 = st.columns(3)
        cont1 = cols1.container(border=True,height=300)
        cont2 = cols2.container(border=True,height=300)
        cont3 = cols3.container(border=True,height=300)
        professores = pd.read_csv(os.path.join(DATA_DIR, f"professores_{st.session_state['semestre']}.csv"))
        disciplinas = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
        colunas = disciplinas.columns.tolist()
        cont1.markdown(f"**Professores do DMAT**")
        cont1.radio("Selecione o professor:", options=professores["Docentes"].tolist(), key='professor',label_visibility="collapsed")
        cont2.markdown(f"**Atribuição de disciplinas**")
        disciplinas_livres = disciplinas[disciplinas[colunas[-1]].isna()]
        if not disciplinas_livres.empty:
            cont2.selectbox("Selecione a disciplina:", options=disciplinas_livres, index=None, placeholder="Selecione uma disciplina", key='disciplina',label_visibility="collapsed", format_func=lambda x: f'{disciplinas_livres.iloc[x-1,0]} - {disciplinas_livres.iloc[x-1,2]}')
        cont2.markdown(f"**Atribuidas ao professor**") 
        profdis = disciplinas[disciplinas[colunas[-1]]==st.session_state['professor']]
        if not profdis.empty:
            # cont2.dataframe(profdis, use_container_width=True, hide_index=True)
            for index, row in profdis.iterrows():
                cont2.checkbox(f"{row['Ordem']} - {row[colunas[1]]}", value=True, key=f"checkbox_{index}")
        else:
            cont2.markdown("Nenhuma disciplina atribuída ao professor.")
        
        cont2.button("Atribuir", use_container_width=True)

        st.dataframe(disciplinas, use_container_width=True, hide_index=True)

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