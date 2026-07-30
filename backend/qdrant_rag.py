import os
import glob
import json
import math
import uuid
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    from langchain_groq import ChatGroq
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatGroq = None
    ChatPromptTemplate = None

load_dotenv()

COLLECTION_NAME = "iiui_knowledge_base"
VECTOR_SIZE = 384
MIN_RELEVANCE_SCORE = 0.45  # Relevance threshold for Qdrant vector matches

GREETING_PATTERNS = [
    r"\bhello\b", r"\bhi\b", r"\bhey\b", r"\bassalam\b", r"\baslam\b", r"\baoa\b", 
    r"\balaikum\b", r"\bgreetings\b", r"\bgood morning\b", r"\bgood afternoon\b", 
    r"\bgood evening\b", r"\bwho are you\b", r"\bkaun ho\b", r"\bkon ho\b", r"\bhelp\b"
]

class IIUIRAGPipeline:
    def __init__(self):
        self.qdrant_url = os.getenv("QDRANT_URL")
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        
        self.client = None
        self._encoder = None
        self.llm = None
        
        self._init_client()
        self._init_llm()

    @property
    def encoder(self):
        if self._encoder is None and SentenceTransformer is not None:
            try:
                print("[RAG] Lazy loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
                self._encoder = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as e:
                print(f"[RAG] Error loading encoder: {e}")
        return self._encoder

    def _encode_text(self, text: str) -> List[float]:
        """Encode text using local SentenceTransformer or fallback REST API."""
        if self.encoder is not None:
            return self.encoder.encode(text).tolist()
        
        # Fallback to Hugging Face Inference REST API (Zero PyTorch needed in production!)
        try:
            import requests
            api_url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
            response = requests.post(api_url, json={"inputs": text, "options": {"wait_for_model": True}}, timeout=10)
            if response.status_code == 200:
                res = response.json()
                if isinstance(res, list):
                    if len(res) > 0 and isinstance(res[0], list):
                        return res[0]
                    elif len(res) == VECTOR_SIZE:
                        return res
        except Exception as e:
            print(f"[RAG] Embedding REST API notice: {e}")
        
        # Dummy vector fallback if offline
        return [0.0] * VECTOR_SIZE

    def _init_client(self):
        if self.qdrant_url and self.qdrant_api_key:
            try:
                self.client = QdrantClient(url=self.qdrant_url, api_key=self.qdrant_api_key)
                print(f"[RAG] Connected to Qdrant Cloud.")
            except Exception as e:
                print(f"[RAG] Failed to connect to Qdrant Cloud: {e}")
        else:
            print("[RAG] QDRANT_URL or QDRANT_API_KEY missing from environment.")

    def _init_llm(self):
        if self.groq_api_key and ChatGroq:
            try:
                self.llm = ChatGroq(
                    temperature=0.2,
                    groq_api_key=self.groq_api_key,
                    model_name="llama-3.3-70b-versatile"
                )
                print(f"[RAG] Initialized Groq LLM.")
            except Exception as e:
                print(f"[RAG] Error initializing Groq LLM: {e}")
        else:
            print("[RAG] GROQ_API_KEY missing or langchain_groq not installed.")

    def is_greeting(self, query: str) -> bool:
        """Check if query is a basic greeting."""
        q_clean = query.strip().lower()
        for pattern in GREETING_PATTERNS:
            if re.search(pattern, q_clean):
                return True
        return False

    def get_greeting_response(self) -> Dict[str, Any]:
        """Return a warm welcome message for basic greetings."""
        answer = (
            "### Welcome to IBADAT International University (IIUI)\n\n"
            "Walaikum Assalam / Hello! I am the official **IBADAT International University, Islamabad (IIUI) AI Assistant**.\n\n"
            "I am here to assist you with official university information on:\n"
            "- 🎓 **Admissions 2026 Criteria & Required Documents**\n"
            "- 💳 **Program Fee Structures** (BS CS, BS AI, Pharm-D, DPT, BBA, etc.)\n"
            "- 🏢 **Hostel Allocation & Semester Dues**\n"
            "- 🏛️ **Faculties & Academic Regulations**\n\n"
            "How can I help you with IIUI university information today?\n\n"
            "---\n"
            "- **Admission Office**: IBADAT International University, Islamabad (IIUI) | Phone: +92-51-9019619 | Email: `admissions@iiui.edu.pk` | Islamabad, Pakistan."
        )
        return {
            "query": "greeting",
            "answer": answer,
            "confidence_score": 1.0,
            "sources": [],
            "citations": [],
            "conversation_id": str(uuid.uuid4())
        }

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search Qdrant Cloud collection using vector similarity."""
        if not self.client:
            print("[RAG] Qdrant client not initialized.")
            return []

        try:
            query_vector = self._encode_text(query)
            search_results = self.client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=top_k
            )

            docs = []
            for hit in search_results:
                docs.append({
                    "score": hit.score,
                    "content": hit.payload.get("content", ""),
                    "filename": hit.payload.get("filename", "Document"),
                    "title": hit.payload.get("title", "IIUI Record"),
                    "chunk_index": hit.payload.get("chunk_index", 0)
                })
            return docs
        except Exception as e:
            print(f"[RAG] Error searching Qdrant: {e}")
            return []

    def answer_query(self, query: str) -> Dict[str, Any]:
        """Process user query and return grounded RAG answer."""
        if self.is_greeting(query):
            return self.get_greeting_response()

        retrieved_docs = self.search(query, top_k=3)
        relevant_docs = [doc for doc in retrieved_docs if doc.get("score", 0.0) >= MIN_RELEVANCE_SCORE]
        
        sources_meta = []
        citations_list = []
        
        for idx, doc in enumerate(relevant_docs, 1):
            sources_meta.append({
                "title": f"IBADAT International University Fee Document ({doc['filename']})" if doc['filename'].endswith('.pdf') else doc['title'],
                "filename": doc['filename'],
                "score": round(doc['score'], 4),
                "snippet": doc['content'][:150] + "..."
            })
            citations_list.append(f"[{idx}] {doc['filename']}")

        highest_score = max([d['score'] for d in relevant_docs], default=0.0)
        confidence = round(highest_score, 2)

        if not relevant_docs:
            answer = (
                "### Out of Scope / Unverified Query Notice\n\n"
                "I am strictly programmed to answer questions regarding **IBADAT International University, Islamabad (IIUI)** "
                "based exclusively on verified university fee structures, admission guidelines, and academic records.\n\n"
                "The information requested is either out of scope or not present in the official IIUI records.\n\n"
                "---\n"
                "- **Official IIUI Website**: [https://iiui.edu.pk](https://iiui.edu.pk)\n"
                "- **Admission Office Contact**: +92-51-9019619 | Email: `admissions@iiui.edu.pk`"
            )
            return {
                "query": query,
                "answer": answer,
                "confidence_score": 0.0,
                "sources": [],
                "citations": [],
                "conversation_id": str(uuid.uuid4())
            }

        context_blocks = []
        for idx, doc in enumerate(relevant_docs, 1):
            context_blocks.append(f"--- Document [{idx}] ({doc['filename']}) ---\n{doc['content']}")
        context_str = "\n\n".join(context_blocks)

        prompt_template = """You are the official IBADAT International University, Islamabad (IIUI) AI Assistant.
Answer the user's question using ONLY the provided official university context below.

STRICT GROUNDING RULES:
1. Always state the university name correctly as "IBADAT International University, Islamabad (IIUI)".
2. Extract exact figures, fee amounts, seat counts, and semester details from the context.
3. Present fee structures and numerical details in clean Markdown Tables.
4. Do NOT hallucinate or guess details not present in the context.
5. End your response with official contact information:
   - Admission Office: IBADAT International University, Islamabad (IIUI) | Phone: +92-51-9019619 | Email: admissions@iiui.edu.pk | Islamabad, Pakistan.

Context Documents:
{context}

User Question: {query}
"""

        try:
            if self.llm and ChatPromptTemplate:
                prompt = ChatPromptTemplate.from_template(prompt_template)
                chain = prompt | self.llm
                response = chain.invoke({"context": context_str, "query": query})
                answer = response.content
            else:
                answer = f"### Retrieved Information\n\n{context_str}\n\n*Note: Add GROQ_API_KEY for full AI synthesis.*"

        except Exception as e:
            print(f"[RAG] Error calling Groq LLM: {e}")
            answer = f"### Retrieved Context\n\n{context_str}\n\n*(Error generating LLM synthesis: {e})*"

        return {
            "query": query,
            "answer": answer,
            "confidence_score": confidence,
            "sources": sources_meta,
            "citations": citations_list,
            "conversation_id": str(uuid.uuid4())
        }

if __name__ == "__main__":
    rag = IIUIRAGPipeline()
    res = rag.answer_query("Aslam o alikum")
    print(res["answer"])
