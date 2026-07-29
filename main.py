import os
import sys
import json
from document_manager import DocumentManager
from rag_pipeline import RAGPipeline
from graph_workflow import LangGraphWorkflow

def run_query(app, query_text: str, idx: int = 1):
    initial_state = {
        "user_query": query_text,
        "category": "",
        "retrieved_docs": [],
        "file_audit_results": {},
        "generated_response": "",
        "quality_score": 0.0,
        "retry_count": 0,
        "error_logs": [],
        "is_complete": False
    }

    result = app.invoke(initial_state)

    print(f"\n--- Query: '{query_text}' ---")
    print(f"Category Classified: {result.get('category')}")
    print(f"Generated Answer:\n{result.get('generated_response')}")
    print("-" * 60)

    return {
        "test_id": idx,
        "query": query_text,
        "category": result.get("category"),
        "retrieved_docs_count": len(result.get("retrieved_docs", [])),
        "file_audit_results": result.get("file_audit_results"),
        "quality_score": result.get("quality_score"),
        "retry_count": result.get("retry_count"),
        "error_logs": result.get("error_logs"),
        "generated_response": result.get("generated_response")
    }

def main():
    print("=" * 65)
    print("  IBADAT International University Autonomous QA Agent (UniAssist-AI)")
    print("=" * 65)

    base_dir = os.path.dirname(__file__)
    docs_dir = os.path.join(base_dir, "docs")
    pdf_dir = os.path.join(base_dir, "scraped_output", "fee_pdfs")

    print("\n[1] Ingesting Knowledge Base Documents & Fee PDFs...")
    doc_mgr = DocumentManager([docs_dir, pdf_dir])

    print("\n[2] Initializing RAG Pipeline & Vector Index...")
    rag = RAGPipeline(doc_mgr.doc_content_cache)

    print("\n[3] Building LangGraph Workflow...")
    workflow = LangGraphWorkflow(doc_mgr, rag)
    app = workflow.graph
    print("Graph compiled successfully.")

    # Simple input handling
    if len(sys.argv) > 1:
        user_query = " ".join(sys.argv[1:])
    else:
        user_query = input("\nEnter your query: ").strip()

    if not user_query:
        user_query = "What is the fee structure for BS Artificial Intelligence?"

    print("\nExecuting Query...")
    log_item = run_query(app, user_query)

    log_file = os.path.join(base_dir, "execution_log.json")
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump([log_item], f, indent=2)

    print(f"\nExecution finished. Log saved to '{log_file}'.")

if __name__ == "__main__":
    main()
