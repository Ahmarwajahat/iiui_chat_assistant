from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from document_manager import DocumentManager
from rag_pipeline import RAGPipeline

class AgentState(TypedDict):
    user_query: str
    category: str
    retrieved_docs: List[str]
    file_audit_results: Dict[str, Any]
    generated_response: str
    quality_score: float
    retry_count: int
    error_logs: List[str]
    is_complete: bool


class LangGraphWorkflow:
    def __init__(self, doc_manager: DocumentManager, rag_pipeline: RAGPipeline):
        self.doc_manager = doc_manager
        self.rag = rag_pipeline
        self.graph = self.build_graph()

    def intent_classifier_node(self, state: AgentState) -> dict:
        query = state.get("user_query", "").lower()
        errors = list(state.get("error_logs", []))

        university_keywords = [
            "iiui", "ibadat", "university", "admission", "fee", "fees", "cost", "tuition",
            "program", "course", "degree", "bs", "ms", "dpt", "pharm", "nursing", "bba",
            "cs", "se", "ai", "civil", "hostel", "scholarship", "hec", "criteria", "eligibility",
            "calendar", "semester", "seat", "seats", "helpline", "contact", "apply"
        ]

        try:
            # Check if query is outside university domain
            is_relevant = any(kw in query for kw in university_keywords)
            if not is_relevant and len(query.split()) > 2:
                return {"category": "Out_Of_Scope", "error_logs": errors}

            if "fee" in query and ("eligibility" in query or "criteria" in query or "bs" in query or "dpt" in query or "ai" in query or "structure" in query or "about" in query):
                category = "High_Complexity"
            elif "fee" in query or "seat" in query or "cost" in query or "tuition" in query:
                category = "Fee_System_Audit"
            elif "eligibility" in query or "criteria" in query or "program" in query or "admission" in query:
                category = "Academic_RAG"
            else:
                category = "FAQ"

            return {"category": category, "error_logs": errors}
        except Exception as e:
            errors.append(f"Classifier Error: {e}")
            return {"category": "FAQ", "error_logs": errors}

    def permission_denied_node(self, state: AgentState) -> dict:
        """Returns permission denied message for out-of-scope queries."""
        errors = list(state.get("error_logs", []))
        msg = "Sorry, you do not have permission to ask queries outside IBADAT International University data."
        return {
            "generated_response": msg,
            "quality_score": 1.0,
            "is_complete": True,
            "error_logs": errors
        }

    def vector_retrieval_node(self, state: AgentState) -> dict:
        query = state.get("user_query", "")
        errors = list(state.get("error_logs", []))

        try:
            docs = self.rag.retrieve(query)
            if not docs:
                errors.append("No docs retrieved from vector search.")
            return {"retrieved_docs": docs, "error_logs": errors}
        except Exception as e:
            errors.append(f"Vector Retrieval Error: {e}")
            return {"retrieved_docs": [], "error_logs": errors}

    def file_audit_node(self, state: AgentState) -> dict:
        query = state.get("user_query", "").lower()
        errors = list(state.get("error_logs", []))
        audit_res = {}

        try:
            if "bs ai" in query or "artificial intelligence" in query or "ai" in query.split() or "ai fee" in query:
                prog = "BS_AI"
            elif "bs cs" in query or "computer science" in query:
                prog = "BS_CS"
            elif "bs se" in query or "software engineering" in query:
                prog = "BS_SE"
            elif "civil" in query:
                prog = "BS_Civil"
            elif "dpt" in query or "physical therapy" in query:
                prog = "DPT"
            elif "pharm" in query or "pharmacy" in query:
                prog = "Pharm_D"
            else:
                prog = None

            if prog:
                data = self.doc_manager.search_program_fee(prog)
                if data:
                    audit_res = data
                else:
                    audit_res = {"status": "not_found", "program": prog}
            else:
                audit_res = {"campus_info": "IIUI Islamabad Chartered Campus"}

            return {"file_audit_results": audit_res, "error_logs": errors}
        except Exception as e:
            errors.append(f"File Audit Error: {e}")
            return {"file_audit_results": {}, "error_logs": errors}

    def response_generator_node(self, state: AgentState) -> dict:
        query = state.get("user_query", "")
        docs = state.get("retrieved_docs", [])
        audit = state.get("file_audit_results", {})
        retry_count = state.get("retry_count", 0)
        errors = list(state.get("error_logs", []))

        try:
            answer = self.rag.generate_response(query, docs, audit)

            quality_score = 0.95
            if not docs and not audit:
                quality_score = 0.4

            if retry_count > 0:
                quality_score = min(1.0, quality_score + 0.2)

            return {
                "generated_response": answer,
                "quality_score": quality_score,
                "error_logs": errors
            }
        except Exception as e:
            errors.append(f"Generator Error: {e}")
            return {
                "generated_response": "An error occurred while generating response.",
                "quality_score": 0.0,
                "error_logs": errors
            }

    def fallback_node(self, state: AgentState) -> dict:
        errors = list(state.get("error_logs", []))
        msg = (
            "We could not process your query through standard search.\n"
            "Please contact the IIUI Admissions Office:\n"
            "- Helpline: +92-51-111-234-567\n"
            "- Email: admissions@iiui.edu.pk"
        )
        return {"generated_response": msg, "quality_score": 1.0, "is_complete": True, "error_logs": errors}

    def logger_node(self, state: AgentState) -> dict:
        return {"is_complete": True}

    def route_by_intent(self, state: AgentState) -> str:
        cat = state.get("category", "FAQ")
        if cat == "Out_Of_Scope":
            return "denied"
        elif cat == "High_Complexity":
            return "parallel_branch"
        elif cat == "Fee_System_Audit":
            return "file_audit"
        else:
            return "vector_retrieval"

    def quality_check_edge(self, state: AgentState) -> str:
        score = state.get("quality_score", 1.0)
        retries = state.get("retry_count", 0)

        if score < 0.7 and retries < 2:
            state["retry_count"] = retries + 1
            return "retry"
        return "pass"

    def build_graph(self):
        builder = StateGraph(AgentState)

        # Add Nodes
        builder.add_node("IntentClassifier", self.intent_classifier_node)
        builder.add_node("PermissionDenied", self.permission_denied_node)
        builder.add_node("VectorRetrieval", self.vector_retrieval_node)
        builder.add_node("FileAudit", self.file_audit_node)
        builder.add_node("ResponseGenerator", self.response_generator_node)
        builder.add_node("FallbackNode", self.fallback_node)
        builder.add_node("LoggerNode", self.logger_node)

        # Flow Edges
        builder.add_edge(START, "IntentClassifier")

        builder.add_conditional_edges(
            "IntentClassifier",
            self.route_by_intent,
            {
                "denied": "PermissionDenied",
                "parallel_branch": "VectorRetrieval",
                "file_audit": "FileAudit",
                "vector_retrieval": "VectorRetrieval"
            }
        )

        builder.add_edge("PermissionDenied", END)
        builder.add_edge("VectorRetrieval", "FileAudit")
        builder.add_edge("FileAudit", "ResponseGenerator")

        builder.add_conditional_edges(
            "ResponseGenerator",
            self.quality_check_edge,
            {
                "retry": "ResponseGenerator",
                "pass": "LoggerNode"
            }
        )

        builder.add_edge("LoggerNode", END)
        builder.add_edge("FallbackNode", END)

        return builder.compile()
