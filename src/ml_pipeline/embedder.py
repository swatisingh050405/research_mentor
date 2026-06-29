import json
from sentence_transformers import SentenceTransformer
from src.common.logger import logger
from src.common.config_loader import CONFIG, EXTRACTED_PAPERS_JSON

class PaperEmbedder:
    def __init__(self):
        """Initializes the local open-source embedding engine framework."""
        # Load the model name from centralized configuration
        self.model_name = CONFIG["embedding"]["model_name"]
        logger.info(f"Loading Local SentenceTransformer engine: '{self.model_name}'")
        
        self.model = SentenceTransformer(self.model_name)
        logger.info("Embedding engine model successfully loaded onto active workspace.")

    def load_local_extracted_dataset(self) -> list:
        """Reads the persistent diverse offline JSON dataset from the data folder."""
        if not EXTRACTED_PAPERS_JSON.exists():
            logger.error(f"Extracted dataset database missing at: {EXTRACTED_PAPERS_JSON}")
            return []
        
        with open(EXTRACTED_PAPERS_JSON, "r", encoding="utf-8") as f:
            papers = json.load(f)
        logger.info(f"Successfully read {len(papers)} items from offline dataset storage.")
        return papers

    def construct_embedding_text(self, title: str, abstract: str) -> str:
        """Merges title and abstract context strings into one rich token group for better semantic indexing."""
        return f"Title: {title}. Abstract: {abstract}"

    def encode_text(self, text_or_list) -> list:
        """
        Universal Encoder: Takes a single string OR a list of strings,
        """
        # Model.encode natively handles both single strings and lists!
        embeddings = self.model.encode(text_or_list, show_progress_bar=False)
        return embeddings.tolist()

    # Data transformation pipeline wrapper for our DB loader
    def process_and_vectorize_batch(self, papers: list) -> tuple:
        """Processes raw paper dict lists and maps them using our universal encoder."""
        if not papers:
            return [], []
        
        # 1. Sirf text structure sajane ka kaam kiya
        combined_texts = [self.construct_embedding_text(p["title"], p["abstract"]) for p in papers]
        
        # 2. Universal encoder machine ko poori list hand-over kar di
        logger.info(f"Running zero-cost local tensor encoding on {len(combined_texts)} items...")
        vector_matrix = self.encode_text(combined_texts)
        
        return vector_matrix, combined_texts


if __name__ == "__main__":
    embedder = PaperEmbedder()
    
    # Load the offline dataset for embedding processing
    offline_dataset = embedder.load_local_extracted_dataset()
    
    if offline_dataset:
        # Process a small sample for quick validation
        vectors, raw_texts = embedder.process_and_vectorize(offline_dataset[:3])
        print("\n--- MATRIX EMBEDDING STRUCTURAL CHECK ---")
        print(f"Sample Document Vector Length: {len(vectors[0])} values")
        print(f"Sample Processed Text Preview: {raw_texts[0][:120]}...")