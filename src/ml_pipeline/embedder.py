from sentence_transformers import SentenceTransformer
from src.common.logger import logger

class PaperEmbedder:
    def __init__(self):
        """Initializes the local SentenceTransformer embedding model."""
        # Using the standard local semantic matching model
        self.model_name = "all-MiniLM-L6-v2"
        logger.info(f"Loading Local SentenceTransformer engine: '{self.model_name}'")
        try:
            self.model = SentenceTransformer(self.model_name)
            logger.info("Embedding engine model successfully loaded onto active workspace.")
        except Exception as e:
            logger.error(f"Failed to load embedding transformer model: {e}")
            raise e

    def construct_embedding_text(self, title: str, abstract: str) -> str:
        """
        Standardizes the long-form text structure for database vector ingestion.
        """
        return f"{title}\n\n{abstract}"

    def construct_query_text(self, query: str) -> str:
        """
        Standardizes the short user query to mimic the structural weight of the ingestion text.
        """
        return f"{query}".strip()

    def encode_text(self, text: str) -> list:
        """
        Generates a dense vector embedding array from raw string data.
        """
        if not text:
            return None
        return self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

    def encode_batch(
        self,
        texts
    ) -> list:
        """
        Generates a dense vector embedding array from raw string data.
        """

        return self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

    def find_similar_papers(self,collection,title: str,abstract: str,top_k: int = 6
):
        """
        Finds semantically similar papers from ChromaDB.
        """

        query_text = self.construct_embedding_text(title, abstract)

        query_embedding = self.encode_text(query_text)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k + 1,
            include=["metadatas", "distances"]
        )

        return results