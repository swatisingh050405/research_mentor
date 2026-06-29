# src/ml_pipeline/vector_store.py
import chromadb
from src.common.logger import logger
from src.common.config_loader import CONFIG, CHROMA_DB_PATH
from src.ml_pipeline.embedder import PaperEmbedder

class VectorStoreManager:
    def __init__(self):
        """Initializes the persistent ChromaDB storage writer layer."""
        self.collection_name = "academic_papers"
        
        logger.info(f"Connecting local persistent Chroma DB layer at: {CHROMA_DB_PATH}")
        self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
        self.embedder = PaperEmbedder()
        
        # Cosine distance model matrix configuration
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"Storage Collection initialized: '{self.collection_name}'")

    def upsert_papers_to_db(self, papers: list):
        """
        Generates vector embeddings locally and populates ChromaDB.
        """
        if not papers:
            logger.warning("No structural paper records available for storage execution.")
            return

        # Core vectors conversion array call
        embeddings, combined_texts = self.embedder.process_and_vectorize(papers)
        ids = [str(p["id"]) for p in papers]
        
        # Flatten and safely clean metadata types for Chroma validation rules
        metadatas = [
            {
                "title": p.get("title", "Unknown Title"),
                "authors": ", ".join(p.get("authors", [])) if isinstance(p.get("authors"), list) else str(p.get("authors", "")),
                "url": p.get("link", p.get("url", "")),
                "year": str(p.get("year", "0000")),
                "abstract": p.get("abstract", "")  # Persistent storage context for frontend card expand options
            }
            for p in papers
        ]

        logger.info(f"Executing database upsert transaction for {len(papers)} documents...")
        
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=combined_texts,
            metadatas=metadatas
        )
        logger.info(f"Database sync successful. Collection now tracking: {self.collection.count()} elements.")

if __name__ == "__main__":
    # Seed the local Vector DB database using our extracted baseline JSON papers corpus
    writer = VectorStoreManager()
    dataset = writer.embedder.load_local_extracted_dataset()
    
    if dataset:
        writer.upsert_papers_to_db(dataset)
        print("\n[SUCCESS] Vector DB successfully populated with baseline dataset entries!")