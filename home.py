import streamlit as st
import pandas as pd
import time
from streamlit_autorefresh import st_autorefresh

def on_click_callback():
    """Função de callback para o botão 'Acompanhar distribuição'."""
    st.session_state.page = "acompanhamento"

def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)

def run():
   

    # Centraliza com colunas e flex
    if st.session_state['page']=="home":
        load_css("./assets/css/styles.css")
        st.markdown("""<div class="title-text">Aplicativo de distribuição de disciplinas - DEMAT - UFMT</div>""", unsafe_allow_html=True)
        col1, col2, col3 = st.columns([0.3, 0.4, 0.3])
        with col2:
            st.markdown('<div class="button-space"></div>', unsafe_allow_html=True)
            
            if st.button("Acesse o aplicativo", use_container_width=True):
                st.login()
            
            acompanhar = st.button("Acompanhar distribuição", use_container_width=True, on_click=on_click_callback)

    

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
     
if __name__ == "__main__":
    run()
