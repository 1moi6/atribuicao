import streamlit as st
from botao.my_component import increment_button

st.title("Teste do Botão Incrementador")

valor = increment_button("Clique para somar")
st.write(f"Valor atual: {valor}")