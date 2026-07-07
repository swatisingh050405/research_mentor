import numpy as np
from google import genai
from src.common.logger import logger
from src.common.config_loader import CONFIG


class PaperEmbedder:
    def __init__(self):
        """Initializes the Gemini Embedding client."""

        api_key = CONFIG["api"]["gemini"]["api_key"]

        self.client = genai.Client(api_key=api_key)

        self.model_name = "gemini-embedding-001"

        logger.info(
            f"Gemini Embedding model initialized: {self.model_name}"
        )

    def construct_embedding_text(
        self,
        title: str,
        abstract: str
    ) -> str:
        return f"{title}\n\n{abstract}"

    def construct_query_text(
        self,
        query: str
    ) -> str:
        return query.strip()

    def encode_text(
        self,
        text: str
    ):
        """
        Generates embedding for a single text.
        """

        if not text:
            return None

        response = self.client.models.embed_content(
            model=self.model_name,
            contents=text,
        )

        return np.array(response.embeddings[0].values)

    def encode_batch(
        self,
        texts: list
    ):
        """
        Generates embeddings for multiple texts.
        """

        embeddings = []

        for text in texts:

            response = self.client.models.embed_content(
                model=self.model_name,
                contents=text,
            )

            embeddings.append(
                response.embeddings[0].values
            )

        return np.array(embeddings)

    def find_similar_papers(
        self,
        collection,
        title: str,
        abstract: str,
        top_k: int = 6,
    ):

        query_text = self.construct_embedding_text(
            title,
            abstract,
        )

        query_embedding = self.encode_text(query_text)

        return collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k + 1,
            include=["metadatas", "distances"],
        )