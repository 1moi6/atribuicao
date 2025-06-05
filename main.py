import streamlit as st
import os
import sys
import home
import sistema
import pandas as pd

# project_root = os.path.dirname(os.path.abspath(__file__))
# componentes_dir = os.path.join(project_root, 'componentes')
# if componentes_dir not in sys.path:
#     sys.path.append(componentes_dir)
# from my_component import my_component as componente



st.set_page_config(page_title="Otimizando a distribuição", page_icon="./assets/images/ialogo2.png",initial_sidebar_state="collapsed")

# args_navbar = {
#     "tipo": "navbar",
#     "opcoes": ["Início",  "Sistema de atribuição",'Análise de conflitos'],
#     "icons": ["home",  "syncalt","event_busy"],
#     "user_name":'Moiseis',
#     'seletor_opcoes':["Maio", "Junho", "Julho"]
#     }

# clicked_page = componente(**args_navbar, key="navbar_dinamica")
# st.write(clicked_page)

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

# if clicked_page:
#     if clicked_page.get("tipo",None)=='pagina':
#         if clicked_page["valor"] =="Sistema de atribuição":
#             st.session_state.update({"page": "sistema"})
#         if clicked_page["valor"] =="Início":
#             st.session_state.update({"page": "home"})
#         if clicked_page["valor"] =="Início":
#             st.session_state.update({"page": "home"})

if not st.user.is_logged_in:
    home.run()
    pass

else:
    try:
        st.session_state['user_email'] = st.user.email
    except:
        pass
    sistema.run()
    
