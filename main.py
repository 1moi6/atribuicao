import streamlit as st
import os
import home
import sistema
import componente
st.set_page_config(page_title="Otimizando a distribuição", page_icon="./assets/images/ialogo2.png",initial_sidebar_state="collapsed")

# st.logo("./assets/images/ialogo.png", icon_image="./assets/images/ialogo2.png")

base_path = os.path.dirname(os.path.abspath(__file__))


if 'page' not in st.session_state:
    st.session_state['page'] = "home"

def load_css(file_name: str):
    """Função para carregar CSS externo e aplicá-lo no Streamlit."""
    with open(file_name, "r") as f:
        css = f.read()
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)

load_css("./assets/css/styles.css")
if not st.user.is_logged_in:
    home.run()
else:
    sistema.run()
    

try:
    st.session_state['user_email'] = st.user.email
except:
    pass

print(st.session_state.get('page', False))



# sidebar = st.sidebar
# sidebar.button("Início", key="home", on_click=lambda: st.session_state.page("home"))
# sidebar.button("Sobre", key="about", on_click=lambda: st.session_state.page("about"))
# sidebar.button("Otimizando a distribuição", key="optimize", on_click=lambda: st.session_state.page("optimize")) 
# st.markdown("Otimizando a distribuição")


