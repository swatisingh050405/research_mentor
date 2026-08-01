import time
import numpy as np
from google import genai

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG


class PaperEmbedder:
    """
    Pure text -> vector conversion layer using Gemini's embedding model.

    """

    def __init__(self):
        """Initializes the Gemini Embedding client."""

        api_key = CONFIG["api"]["gemini"]["api_key"]

        self.client = genai.Client(api_key=api_key)

        self.model_name = CONFIG.get("embedding", {}).get(
            "model_name", "gemini-embedding-001"
        )

        # Embedding calls run at much higher volume now (reranking fetches
        # many candidate papers per search), so retries matter here too —
        # a single transient failure shouldn't need to bubble all the way
        # up and fail the whole batch.
        self.max_retry = 3
        self.retry_delays = [1, 2, 4]

        logger.info(f"Gemini Embedding model initialized: {self.model_name}")

    def construct_embedding_text(self, title: str, abstract: str) -> str:
        """Builds the canonical text representation of a paper for embedding."""
        return f"{title}\n\n{abstract}"

    def construct_query_text(self, query: str) -> str:
        """Builds the canonical text representation of a search query for embedding."""
        return query.strip()

    def encode_text(self, text: str):
        """
        Generates an embedding for a single piece of text, with retries
        on transient failures.

        Returns
        -------
        np.ndarray or None
            The embedding vector, or None if the text is empty or all
            retry attempts fail.
        """
        if not text:
            return None

        for attempt in range(self.max_retry):
            try:
                response = self.client.models.embed_content(
                    model=self.model_name,
                    contents=text,
                )
                return np.array(response.embeddings[0].values)

            except Exception as e:
                if attempt < self.max_retry - 1:
                    wait = self.retry_delays[attempt]
                    logger.warning(
                        f"Gemini embedding failed (single text). "
                        f"Retry {attempt + 1}/{self.max_retry} in {wait}s. Error: {e}"
                    )
                    time.sleep(wait)
                else:
                    logger.error(f"Gemini embedding failed for single text after retries: {e}")
                    return None

    def encode_batch(self, texts: list):
        """
        Generates embeddings for multiple texts, retrying each one
        individually on transient failures.

        Returns
        -------
        tuple(np.ndarray, list[int])
            The stacked embeddings, and the list of original indices
            (into `texts`) that were successfully embedded, in order.
        """
        embeddings = []
        successful_indices = []

        for index, text in enumerate(texts):

            if not text:
                logger.warning(f"Skipping empty text at index {index} in batch.")
                continue

            vector = self.encode_text(text)

            if vector is None:
                logger.error(f"Embedding failed for batch item {index} after retries. Skipping.")
                continue

            embeddings.append(vector)
            successful_indices.append(index)

        return np.array(embeddings), successful_indices