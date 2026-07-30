import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from server import app
import gradio as gr

# Create a clean Gradio interface wrapper for Hugging Face Spaces
def respond(query):
    from qdrant_rag import IIUIRAGPipeline
    pipeline = IIUIRAGPipeline()
    result = pipeline.answer_query(query)
    return result["answer"]

demo = gr.Interface(
    fn=respond,
    inputs=gr.Textbox(lines=2, placeholder="Ask anything about IBADAT International University..."),
    outputs=gr.Markdown(),
    title="IBADAT International University (IIUI) AI Assistant",
    description="Official Grounded RAG Chatbot powered by Qdrant Cloud & Groq LLM."
)

# Mount FastAPI app onto Gradio so REST endpoints /chat are also available
app = gr.mount_gradio_app(app, demo, path="/ui")

if __name__ == "__main__":
    demo.launch()
