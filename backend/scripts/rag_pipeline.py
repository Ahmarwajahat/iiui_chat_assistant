import os
import math
import re
from typing import List
from dotenv import load_dotenv

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

class SimpleVectorSearch:
    """Local vector search using TF-IDF and cosine similarity."""
    def __init__(self):
        self.docs = []

    def add_documents(self, text_chunks: List[str]):
        self.docs = text_chunks

    def _get_vector(self, text: str):
        words = re.findall(r'\w+', text.lower())
        vec = {}
        for w in words:
            vec[w] = vec.get(w, 0) + 1.0
        return vec

    def search(self, query: str, top_k: int = 3) -> List[str]:
        if not self.docs:
            return []

        q_vec = self._get_vector(query)
        scores = []

        for doc in self.docs:
            d_vec = self._get_vector(doc)
            dot = sum(q_vec.get(w, 0) * d_vec.get(w, 0) for w in q_vec)
            mag_q = math.sqrt(sum(v ** 2 for v in q_vec.values())) or 1.0
            mag_d = math.sqrt(sum(v ** 2 for v in d_vec.values())) or 1.0
            score = dot / (mag_q * mag_d)
            scores.append((score, doc))

        scores.sort(key=lambda x: x[0], reverse=True)
        results = [doc for score, doc in scores[:top_k] if score > 0.0]
        return results if results else self.docs[:top_k]


class RAGPipeline:
    def __init__(self, docs_dict: dict):
        self.docs_dict = docs_dict
        self.vector_db = SimpleVectorSearch()
        self.llm = None
        self.init_pipeline()

    def init_pipeline(self):
        # Setup ChatGroq LLM
        groq_api_key = os.getenv("GROQ_API_KEY")
        if groq_api_key and ChatGroq:
            try:
                self.llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)
            except Exception:
                self.llm = None

        # Build Vector Store
        chunks = []
        for filename, content in self.docs_dict.items():
            if content and filename.endswith('.md'):
                sections = content.split("\n\n")
                for sec in sections:
                    if len(sec.strip()) > 30:
                        chunks.append(sec.strip())

        self.vector_db.add_documents(chunks)

    def retrieve(self, query: str) -> List[str]:
        return self.vector_db.search(query, top_k=3)

    def generate_response(self, query: str, context_docs: List[str], audit_data: dict) -> str:
        context_str = "\n".join(context_docs) if context_docs else "No specific documents found."
        audit_str = str(audit_data) if audit_data else "No audit data."

        if self.llm:
            try:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are an AI Student Assistant for IBADAT International University, Islamabad. "
                               "Answer the query accurately based on the context and audit data provided.\n\n"
                               "Context:\n{context}\n\nAudit Info:\n{audit}"),
                    ("human", "{query}")
                ])
                chain = prompt | self.llm
                res = chain.invoke({"query": query, "context": context_str, "audit": audit_str})
                return res.content.strip()
            except Exception as e:
                print(f"LLM Error: {e}")

        # Fallback generator if LLM unavailable
        return (
            f"Information from IIUI records:\n"
            f"- Relevant Context: {context_str[:250]}...\n"
            f"- Fee/Audit Info: {audit_str}\n"
            f"For further assistance, contact Admissions Office (+92-51-111-234-567)."
        )
