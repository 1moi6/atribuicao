import streamlit as st

def navbar(links: list[str], *, key="navbar", color="black", active_color="#1f77b4"):
    st.markdown(f"""
        <style>
        .stButton>button {{
            background: none;
            border: none;
            color: {color};
            font-size: 16px;
            padding: 0 12px;
            cursor: pointer;
        }}
        .stButton>button:hover {{
            opacity: 0.8;
        }}
        .active-btn > button {{
            color: {active_color} !important;
            text-decoration: underline;
        }}
        .navbar-container {{
            position: fixed;
            top: 0;
            width: 100%;
            background: #262730;
            padding: 12px;
            z-index: 999;
            display: flex;
            gap: 10px;
        }}
        .navbar-space {{ padding-top: 60px; }}
        </style>
    """, unsafe_allow_html=True)

    st.markdown('<div class="navbar-container">', unsafe_allow_html=True)
    cols = st.columns(len(links))
    for i, label in enumerate(links):
        class_name = "active-btn" if st.session_state.get("page") == label else ""
        with cols[i]:
            with st.container():
                btn = st.button(label, key=f"{key}_{label}")
                if btn:
                    st.session_state["page"] = label
        st.markdown(f"<div class='{class_name}'></div>", unsafe_allow_html=True)
    st.markdown("</div><div class='navbar-space'></div>", unsafe_allow_html=True)


def run():
    if "page" not in st.session_state:
        st.session_state.page = "Início"


    navbar(["Início", "Sobre", "Contato"])

    if st.session_state.page == "Início":
        st.write("Página inicial")
    elif st.session_state.page == "Sobre":
        st.write("Informações sobre o app")
    elif st.session_state.page == "Contato":
        st.write("Fale conosco")