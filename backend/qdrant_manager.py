import os
import uuid
from typing import List, Dict, Any
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# 1. Load environment variables securely from .env
load_dotenv()

def get_qdrant_client() -> QdrantClient:
    """Securely initialize and return the Qdrant client using .env settings."""
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if not url or not api_key:
        raise ValueError("QDRANT_URL or QDRANT_API_KEY is missing from .env file!")
    
    return QdrantClient(url=url, api_key=api_key)


def ensure_collection(client: QdrantClient, collection_name: str, vector_size: int = 384):
    """Create collection in Qdrant if it does not exist already."""
    collections = client.get_collections().collections
    collection_names = [col.name for col in collections]
    
    if collection_name not in collection_names:
        print(f"Creating collection '{collection_name}' with vector size {vector_size}...")
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
        )
        print(f"Collection '{collection_name}' created successfully.")
    else:
        print(f"Collection '{collection_name}' already exists.")


def embed_and_store_once(
    client: QdrantClient,
    collection_name: str,
    documents: List[Dict[str, Any]],
    embedding_model,
    vector_size: int = 384,
    force_reindex: bool = False
):
    """
    Converts documents into embeddings ONCE and stores them in Qdrant DB.
    Subsequent calls skip re-embedding if data is already stored.
    """
    ensure_collection(client, collection_name, vector_size=vector_size)
    
    # Check if collection already has points stored
    collection_info = client.get_collection(collection_name=collection_name)
    existing_points_count = collection_info.points_count
    
    if existing_points_count > 0 and not force_reindex:
        print(f"✅ Data already embedded & stored in Qdrant ({existing_points_count} points found). Skipping re-embedding!")
        return
    
    print(f"🔄 Converting {len(documents)} documents to embeddings (ONE-TIME processing)...")
    points = []
    
    for idx, doc in enumerate(documents):
        text_content = doc.get("text", "")
        # Generate vector embedding for document text
        vector = embedding_model.encode(text_content).tolist()
        
        # Unique point ID (integer or UUID)
        point_id = doc.get("id", str(uuid.uuid4()))
        
        points.append(
            PointStruct(
                id=point_id,
                vector=vector,
                payload=doc  # Save full payload / text / metadata
            )
        )
    
    # Upsert points into Qdrant vector DB
    client.upsert(collection_name=collection_name, points=points)
    print(f"✅ Successfully embedded and saved {len(points)} points into Qdrant collection '{collection_name}'!")


def search_vector_db(
    client: QdrantClient,
    collection_name: str,
    query_text: str,
    embedding_model,
    limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Search the existing stored embeddings in Qdrant without re-embedding dataset documents.
    """
    # Embed only the search query
    query_vector = embedding_model.encode(query_text).tolist()
    
    search_results = client.query_points(
        collection_name=collection_name,
        query=query_vector,
        limit=limit
    )
    
    results = []
    for hit in search_results.points:
        results.append({
            "score": hit.score,
            "id": hit.id,
            "payload": hit.payload
        })
    
    return results
