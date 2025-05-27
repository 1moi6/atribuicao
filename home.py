import streamlit as st
import pandas as pd
from streamlit_autorefresh import st_autorefresh
import os
DATA_DIR = "data"

def on_click_callback():
    """Função de callback para o botão 'Acompanhar distribuição'."""
    st.session_state.page = "acompanhamento"

def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)

def muda_pagina():
    xx = st.session_state['menu_options']
    if xx == ":material/arrow_back:":
        st.session_state.update({"page": "home"})
    if xx == ":material/account_circle:":
        st.login()
    if xx == ":material/calendar_month:":
        selecionar_semestre()

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
            
            acompanhar = st.button("Acompanhar distribuição", use_container_width=True, on_click=on_click_callback)

    

    if st.session_state['page']=="acompanhamento":
        load_css("./assets/css/styles.css")
        
        st_autorefresh(interval=5 * 1000, key="data_refresh")
        col1,col2 = st.columns([0.85,0.15],vertical_alignment="top")
        col1.markdown("""
            <style>
            .st-emotion-cache-1wvkpev{
                border: 0px solid #000;
                    }
            </style>
            
        """, unsafe_allow_html=True)
        col1.markdown(f"""
            <div class="title-text-wrapper-left">
                <div class="title-text">Planilha de distribuição de disciplinas - {"/".join(st.session_state['semestre'].split("_"))}</div>
            </div>
        """, unsafe_allow_html=True)
        
        # col3.selectbox("Selecione o semestre", options=set(semestres), key='semestre', index=0, label_visibility="collapsed")
        
        col2.segmented_control("Voltar",options=[":material/calendar_month:",":material/arrow_back:",":material/account_circle:"],label_visibility="collapsed", 
                             on_change=muda_pagina, key='menu_options',selection_mode="single",default = None)
        # st.divider()
        st.markdown('<div class="v-space"></div>', unsafe_allow_html=True)
        
        planilha = pd.read_csv(os.path.join(DATA_DIR, f"disciplinas_{st.session_state['semestre']}.csv"))
        st.dataframe(planilha, use_container_width=True, hide_index=True, height=500)
     
if __name__ == "__main__":
    run()
