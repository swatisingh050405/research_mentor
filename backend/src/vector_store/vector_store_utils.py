import chromadb
from backend.src.core.config_loader import CHROMA_DB_PATH
from backend.src.core.logger import logger

def get_chroma_client():
    return chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

def get_collection_stats():
    """Monitors paper cache size in production without deleting anything."""
    client = get_chroma_client()
    stats = {}
    try:
        collections = client.list_collections()
        for col in collections:
            stats[col.name] = col.count()
        return stats
    except Exception as e:
        logger.error(f"Failed to retrieve ChromaDB stats: {e}")
        return {"error": str(e)}

def clear_pdf_chunks_only():
    """
    Optional admin tool: Purges heavy full-text PDF chunks if disk fills up,
    while leaving the main paper abstract cache 100% untouched.
    """
    client = get_chroma_client()
    try:
        client.delete_collection(name="paper_chunks")
        logger.info("Cleared PDF chunks collection to free disk space. Main paper cache remains active.")
    except Exception as e:
        logger.error(f"Failed to clear paper_chunks: {e}")