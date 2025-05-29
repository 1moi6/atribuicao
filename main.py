import streamlit as st
import os
import home
import sistema
import pandas as pd
st.set_page_config(page_title="Otimizando a distribuição", page_icon="./assets/images/ialogo2.png",initial_sidebar_state="collapsed")

# st.logo("./assets/images/ialogo.png", icon_image="./assets/images/ialogo2.png")

DATA_DIR = "data"


if 'page' not in st.session_state:
    st.session_state['page'] = "home"

if 'disciplinas' not in st.session_state:
    st.session_state['disciplinas'] = pd.DataFrame()

if 'painel' not in st.session_state:
    st.session_state['painel'] = False

if 'menu_options' not in st.session_state:
    st.session_state['menu_options'] = None

if 'professores' not in st.session_state:
    st.session_state['professores'] = pd.DataFrame()

semestres = ["_".join(x.split("_")[1:]).split(".")[0]  for x in os.listdir(DATA_DIR) if x.endswith(".csv")]
if 'semestre' not in st.session_state:
    st.session_state['semestre'] = semestres[0]
def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)

load_css("./assets/css/styles.css")
if not st.user.is_logged_in:
    home.run()
else:
    try:
        st.session_state['user_email'] = st.user.email
    except:
        pass
    sistema.run()
    
