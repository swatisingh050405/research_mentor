
import chromadb
from src.common.logger import logger
from src.common.config_loader import CHROMA_DB_PATH
from src.ml_pipeline.embedder import PaperEmbedder

class PaperSearcher:
    def __init__(self):
        """Initializes the Read-Only Vector Query Engine interface."""
        self.collection_name = "academic_papers"
        
        logger.info(f"Connecting to persistent ChromaDB at: {CHROMA_DB_PATH}")
        self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
        self.embedder = PaperEmbedder()
        self.collection = self.chroma_client.get_collection(name=self.collection_name)
        logger.info(f"Query engine successfully linked to collection: '{self.collection_name}'")

    def semantic_search_db(self, query_text: str, n_results: int = 5) -> list:
        """
        Computes user query vector and pulls closest matches from the vector index.
        """
        logger.info(f"Processing query vector matching lookup for text: '{query_text}'")
        
        # Generate query vector
        query_vector = self.embedder.encode_text(query_text)
        
        results = self.collection.query(
            query_embeddings=[query_vector],
            n_results=n_results
        )
        
        if not results or not results.get("ids") or not results["ids"][0]:
            logger.info("Semantic query execution yielded 0 matrix document alignments.")
            return []

        processed_matches = []
        for idx in range(len(results["ids"][0])):
            distance_score = results["distances"][0][idx] if "distances" in results else 1.0
            similarity_match_score = 1.0 - distance_score  # Inverting cosine distance metric
            
            metadata = results["metadatas"][0][idx]
            
            matched_paper = {
                "id": results["ids"][0][idx],
                "title": metadata.get("title", ""),
                "authors": metadata.get("authors", ""),
                "year": int(metadata.get("year", 0)),
                "url": metadata.get("url", ""),
                "abstract": metadata.get("abstract", ""),
                "similarity": similarity_match_score
            }
            processed_matches.append(matched_paper)
            
        return processed_matches

if __name__ == "__main__":
    searcher = PaperSearcher()
    user_query = input("\nEnter your search topic preference: ")
    
    matches = searcher.semantic_search_db(user_query, n_results=3)
    
    print(f"\n--- ISOLATED SEMANTIC SEARCH ENGINE OUTPUT MATCHES ---")
    for i, paper in enumerate(matches, 1):
        print(f"{i}. Accuracy Score: {paper['similarity']:.4f} | [{paper['year']}] {paper['title']}")