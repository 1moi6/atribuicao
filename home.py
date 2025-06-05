import streamlit as st
import pandas as pd
from streamlit_autorefresh import st_autorefresh
import os
from componente import build_schedule_from_dataframe, plot_schedule_altair
DATA_DIR = "data"

def on_click_callback(x):
    print(x)
    """Função de callback para o botão 'Acompanhar distribuição'."""
    st.session_state.page = x

def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


@st.dialog("Analisar conflito de horários",width = "large")
def analise_conflito():
    disciplinas = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
    colunas = disciplinas.columns.tolist()
    disciplinas_livres = disciplinas[disciplinas[colunas[-1]].isna()]
    selecao = st.multiselect('Selecione as disciplinas de interesse:',options=list(range(len(disciplinas_livres))), placeholder="Todas as disciplinas livres estão selecionadas", format_func=lambda x: f'{disciplinas_livres.iloc[x,0]} - {disciplinas_livres.iloc[x,2]}')
    if len(selecao):
        disciplinas_livres = disciplinas_livres.iloc[selecao,:]
        grade, conflitos, mapa,_ = build_schedule_from_dataframe(disciplinas_livres)
    else:
        grade, conflitos, mapa,_ = build_schedule_from_dataframe(disciplinas_livres)
    st.altair_chart(plot_schedule_altair(grade,conflitos,mapa, None), use_container_width=True)
    if len(conflitos):
        st.markdown(f"**Conflitos de horários**")
        st.dataframe(pd.DataFrame(conflitos),hide_index=True)
    # st.session_state.update({"menu_options":None})


def muda_pagina():
    xx = st.session_state['menu_options']
    if xx == ":material/arrow_back:":
        st.session_state.update({"page": "home"})
    if xx == ":material/account_circle:":
        st.login()
    if xx == ":material/calendar_month:":
        selecionar_semestre()
    if xx == ":material/event_busy:":
        st.session_state.update({"page": "conflitos"})
        pass

def muda_pagina1():
    xx = st.session_state['menu_options1']
    if xx == ":material/arrow_back:":
        st.session_state.update({"page": "home"})
    if xx == ":material/account_circle:":
        st.login()
    if xx == ":material/calendar_month:":
        selecionar_semestre()
    if xx == ":material/event_busy:":
        st.session_state.update({"page": "conflitos"})
        pass

@st.dialog("Selecionar semestre")
def selecionar_semestre():
    semestres = set(["_".join(x.split("_")[1:]).split(".")[0]  for x in os.listdir(DATA_DIR) if x.endswith(".csv")])
    sel_sem = st.selectbox("Selecione um semestre",semestres,index=None,placeholder="Selecione um semestre")
    if sel_sem:
        st.session_state.update({"semestre":sel_sem})
        st.session_state.update({"menu_options":None})
        st.rerun()
    else:
        st.session_state.update({"menu_options":None})

    
def run():
    # Centraliza com colunas e flex
    if st.session_state['page']=="home":
        load_css("./assets/css/styles.css")
        st.markdown("""<div class="title-text">Aplicativo de distribuição de disciplinas - DEMAT - UFMT</div>""", unsafe_allow_html=True)
        col1, col2, col3 = st.columns([0.3, 0.4, 0.3])
        with col2:
            st.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
            
            if st.button("Acessar o sistema", use_container_width=True):
                st.login()
            
            st.button("Analisar conflito de horários", use_container_width=True, on_click=on_click_callback, args=("conflitos",))
            st.button("Acompanhar distribuição", use_container_width=True, on_click=on_click_callback,args=("acompanhamento",))

    

    if st.session_state['page']=="acompanhamento":
        load_css("./assets/css/styles.css")
        col1, col2 = st.columns([0.8,0.2],vertical_alignment="top")
        col2.segmented_control("Voltar",options=[":material/arrow_back:",":material/calendar_month:",":material/event_busy:",":material/account_circle:"],label_visibility="collapsed", 
                             on_change=muda_pagina, key='menu_options',selection_mode="single",default = None)
        col1.markdown(f"""
            <div class="title-text-wrapper-left">
                <div class="title-text">Planilha de distribuição de disciplinas - {"/".join(st.session_state['semestre'].split("_"))}</div>
            </div>
        """, unsafe_allow_html=True)
        st_autorefresh(interval=60 * 1000, key="data_refresh")
        
        
        
        # st.divider()
        st.markdown('<div class="v-space"></div>', unsafe_allow_html=True)
        
        planilha = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
        st.dataframe(planilha, use_container_width=True, hide_index=True,height=3000)
    
    if st.session_state['page']=="conflitos":
        load_css("./assets/css/styles.css")
        col1, col2 = st.columns([0.8,0.2],vertical_alignment="top")
        col2.segmented_control("Voltar",options=[":material/arrow_back:",":material/calendar_month:",":material/event_busy:",":material/account_circle:"],label_visibility="collapsed", 
                             on_change=muda_pagina1, key='menu_options1',selection_mode="single",default = None)
        col1.markdown(f"""
            <div class="title-text-wrapper-left">
                <div class="title-text">Análise de conflitos - {"/".join(st.session_state['semestre'].split("_"))}</div>
            </div>
        """, unsafe_allow_html=True)
        disciplinas = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
        colunas = disciplinas.columns.tolist()
        disciplinas_livres = disciplinas[disciplinas[colunas[-1]].isna()]
        selecao = st.multiselect('Selecione as disciplinas de interesse:',options=list(range(len(disciplinas_livres))), placeholder="Todas as disciplinas livres estão selecionadas", format_func=lambda x: f'{disciplinas_livres.iloc[x,0]} - {disciplinas_livres.iloc[x,2]}')
        if len(selecao):
            disciplinas_livres = disciplinas_livres.iloc[selecao,:]
            grade, conflitos, mapa,_ = build_schedule_from_dataframe(disciplinas_livres)
        else:
            grade, conflitos, mapa,_ = build_schedule_from_dataframe(disciplinas_livres)
        st.altair_chart(plot_schedule_altair(grade,conflitos,mapa, None), use_container_width=True)
        if len(conflitos):
            st.markdown(f"**Conflitos de horários**")
            st.dataframe(pd.DataFrame(conflitos),hide_index=True)
        
     
if __name__ == "__main__":
    run()
