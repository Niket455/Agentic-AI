import os
from dotenv import load_dotenv

from langchain_community.llms import Ollama
import streamlit as st
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()


#langsmith tracking
os.environ["LANGCHAIN_TRACING"] = "true"
api_key = os.getenv("LANGCHAIN_API_KEY")
project = os.getenv("LANGCHAIN_PROJECT")

if api_key:
    os.environ["LANGCHAIN_API_KEY"] = api_key

if project:
    os.environ["LANGCHAIN_PROJECT"] = project


## prompt tempelate
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant. Please answer the following question:"),
        ("user", "Qurestion: {question}"),
    ]
)

## streamlit framework
st.title("Langchain Demo with LLAMA2")
input_text = st.text_input("Enter your question here:")

##Ollama LLama2 model
llm = Ollama(model="gemma:2b")
output_parser = StrOutputParser()
chain=prompt|llm|output_parser

if input_text:
    response = chain.invoke({"question": input_text})
    st.write("Answer:", response)