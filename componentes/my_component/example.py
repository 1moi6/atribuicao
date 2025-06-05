import streamlit as st
from __init__ import my_component # Import from the local __init__.py

st.set_page_config(layout="wide")

st.subheader("Navbar Component Test")

# Define the items for the navbar
nav_items = ["Home", "Data Analysis", "Settings", "About"]

st.write("Click on an item below:")

# Call the navbar component
clicked_item = my_component(items=nav_items, key="navbar_test")

st.write("--- Python Backend --- ")
if clicked_item:
    st.write(f"Received from frontend: **{clicked_item}**")
else:
    st.write("No item clicked yet.")

st.info("This tests the communication. The frontend sends the clicked item, and Python displays it here.")

