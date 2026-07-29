import os
import glob
import json
import math
import uuid
from typing import List, Dict, Any
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from sentence_transformers import SentenceTransformer

try:
    from langchain_groq import ChatGroq
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatGroq = None
    ChatPromptTemplate = None

load_dotenv()

COLLECTION_NAME = "iiui_knowledge_base"
VECTOR_SIZE = 384

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
        if self._encoder is None:
            try:
                print("[RAG] Lazy loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
                self._encoder = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as e:
                print(f"[RAG] Error loading encoder: {e}")
        return self._encoder

    def _init_client(self):
        if self.qdrant_url and self.qdrant_api_key:
            try:
                self.client = QdrantClient(url=self.qdrant_url, api_key=self.qdrant_api_key)
                print(f"[RAG] Connected to Qdrant Cloud.")
            except Exception as e:
                print(f"[RAG] Error connecting to Qdrant: {e}")

    def _init_llm(self):
        if self.groq_api_key and ChatGroq:
            try:
                self.llm = ChatGroq(
                    model="llama-3.3-70b-versatile",
                    temperature=0.2,
                    groq_api_key=self.groq_api_key
                )
                print("[RAG] Initialized Groq LLM.")
            except Exception as e:
                print(f"[RAG] Groq LLM init notice: {e}")

    def ensure_collection(self):
        if not self.client:
            return
        try:
            collections = [col.name for col in self.client.get_collections().collections]
            if COLLECTION_NAME not in collections:
                print(f"[RAG] Creating collection '{COLLECTION_NAME}'...")
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
                )
        except Exception as e:
            print(f"[RAG] Collection check notice: {e}")

    def index_local_documents(self) -> int:
        """Parses and indexes all markdown files AND all 78 fee structure PDFs into Qdrant."""
        if not self.client or not self.encoder:
            return 0

        self.ensure_collection()
        base_dir = os.path.dirname(os.path.dirname(__file__))
        docs_dir = os.path.join(base_dir, "task", "docs")
        scraped_dir = os.path.join(base_dir, "task", "scraped_output")
        
        points = []
        point_id = 1

        # 1. Index Markdown Files
        md_files = glob.glob(os.path.join(docs_dir, "*.md")) + glob.glob(os.path.join(scraped_dir, "*.md"))
        for filepath in md_files:
            filename = os.path.basename(filepath)
            category = filename.replace(".md", "").replace("_", " ").title()
            
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            sections = content.split("\n\n")
            for chunk in sections:
                chunk = chunk.strip()
                if len(chunk) > 35:
                    vector = self.encoder.encode(chunk).tolist()
                    points.append(
                        PointStruct(
                            id=point_id,
                            vector=vector,
                            payload={
                                "filename": filename,
                                "category": category,
                                "text": chunk,
                                "source": f"IBADAT International University (IIUI) - {category}"
                            }
                        )
                    )
                    point_id += 1

        # 2. Index all 78 Fee Structure PDFs from scraped_data.json
        json_path = os.path.join(scraped_dir, "scraped_data.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    scraped_json = json.load(f)
                
                pdf_list = scraped_json.get("pdfs", [])
                for pdf_item in pdf_list:
                    filename = pdf_item.get("filename", "fee_document.pdf")
                    pdf_text = pdf_item.get("text", "").strip()
                    
                    if pdf_text and len(pdf_text) > 30:
                        prog_name = filename.replace("-2026-2.pdf", "").replace("-2025.pdf", "").replace("-Fee-Structure", "").replace("_", " ")
                        formatted_text = f"IBADAT International University Islamabad (IIUI) Fee Document ({filename}):\nProgram / Document: {prog_name}\n\n{pdf_text}"
                        
                        vector = self.encoder.encode(formatted_text).tolist()
                        points.append(
                            PointStruct(
                                id=point_id,
                                vector=vector,
                                payload={
                                    "filename": filename,
                                    "category": "Fee Structure PDF",
                                    "text": formatted_text,
                                    "source": f"IBADAT International University Fee Document ({filename})"
                                }
                            )
                        )
                        point_id += 1
            except Exception as e:
                print(f"[RAG] Error reading scraped_data.json: {e}")

        if points:
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                self.client.upsert(collection_name=COLLECTION_NAME, points=batch)
            return len(points)
        return 0

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Vector similarity search in Qdrant Vector DB."""
        if not self.encoder:
            return []
        
        query_vector = self.encoder.encode(query).tolist()

        if self.client:
            try:
                self.ensure_collection()
                hits = self.client.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vector,
                    limit=top_k
                ).points
                
                results = []
                for hit in hits:
                    results.append({
                        "score": round(hit.score, 4),
                        "id": hit.id,
                        "text": hit.payload.get("text", ""),
                        "category": hit.payload.get("category", "General"),
                        "filename": hit.payload.get("filename", "Doc"),
                        "source": hit.payload.get("source", "IBADAT International University System")
                    })
                return results
            except Exception as e:
                print(f"[RAG] Search error in Qdrant: {e}")
        return []

    def answer_query(self, query: str) -> Dict[str, Any]:
        """Executes full RAG workflow to produce a grounded response with confidence & sources."""
        retrieved_docs = self.search(query, top_k=5)
        
        if retrieved_docs:
            top_score = retrieved_docs[0]["score"]
            confidence = min(0.98, max(0.70, round(top_score * 1.18, 2)))
        else:
            confidence = 0.50

        context_blocks = []
        sources = []
        citations = []

        for idx, doc in enumerate(retrieved_docs, start=1):
            context_blocks.append(f"[{idx}] (Source: {doc['source']})\n{doc['text']}")
            sources.append({
                "title": doc['source'],
                "filename": doc["filename"],
                "score": doc["score"],
                "snippet": doc["text"][:140] + "..."
            })
            citations.append(f"[{idx}] {doc['filename']}")

        context_str = "\n\n".join(context_blocks) if context_blocks else "No specific documents available."

        system_prompt = (
            "You are the official AI Assistant for IBADAT International University, Islamabad (IIUI).\n"
            "CRITICAL INSTRUCTION: The official and correct name of the university is IBADAT International University, Islamabad (IIUI). Never refer to it as International Islamic University.\n"
            "Format your response in clean, beautiful, highly structured Markdown:\n"
            "1. Start with a main heading: ### [Topic Title]\n"
            "2. Group information into clear sub-sections with bold headings (**Item Name**).\n"
            "3. For fee queries (BS AI, BS CS, Pharm-D, DPT, BBA, Hostels), extract exact numbers (Tuition fee per credit hr, Admission charges, Semester contribution, Exam fee, Total semester fee) and present them using bullet points or a Markdown table.\n"
            "4. For admission criteria, list eligibility percentage, required intermediate subjects, and test rules.\n"
            "5. Always end with a divider '---' followed by official contact info:\n"
            "   - **Admission Office**: IBADAT International University, Islamabad (IIUI) | Phone: +92-51-9019619 | Email: `admissions@iiui.edu.pk` | Islamabad, Pakistan."
        )

        answer_text = ""
        if self.llm and ChatPromptTemplate:
            try:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", f"{system_prompt}\n\nRetrieved IBADAT International University Context:\n{context_str}"),
                    ("human", "{query}")
                ])
                chain = prompt | self.llm
                response = chain.invoke({"query": query})
                answer_text = response.content.strip()
            except Exception as e:
                print(f"[RAG] LLM execution error: {e}")

        if not answer_text:
            if retrieved_docs:
                top_doc = retrieved_docs[0]
                answer_text = (
                    f"### IBADAT International University, Islamabad (IIUI)\n\n"
                    f"Based on IIUI official records for **{top_doc['filename']}**:\n\n"
                    f"{top_doc['text']}\n\n"
                    f"---\n"
                    f"**Official Admissions Contact:**\n"
                    f"- **University**: IBADAT International University, Islamabad (IIUI)\n"
                    f"- **Phone**: +92-51-9019619 | **Email**: `admissions@iiui.edu.pk`\n"
                    f"- **Campus**: Islamabad, Pakistan"
                )
            else:
                answer_text = (
                    "### IBADAT International University (IIUI) AI Assistant\n\n"
                    "For specific inquiries regarding BS/MS programs, hostel allocations, fee structures, or campus regulations, "
                    "please reach out directly to IIUI Student Affairs at `info@iiui.edu.pk` or call +92-51-9019619."
                )

        return {
            "query": query,
            "answer": answer_text,
            "confidence_score": confidence,
            "sources": sources,
            "citations": citations,
            "retrieved_count": len(retrieved_docs)
        }
