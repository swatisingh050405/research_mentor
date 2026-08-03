import time
import numpy as np
from google import genai

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG


class PaperEmbedder:
    """
    Converts text into vector embeddings using Gemini Embedding API.

    Supports:
    - Native batch embedding
    - Retry with exponential backoff
    - Automatic chunking
    - Individual fallback
    """

    def __init__(self):
        api_key = CONFIG["api"]["gemini"]["api_key"]

        self.client = genai.Client(api_key=api_key)

        self.model_name = CONFIG.get(
            "embedding", {}
        ).get(
            "model_name",
            "gemini-embedding-001"
        )

        self.max_batch_size = int(
            CONFIG.get("embedding", {}).get("batch_size", 16)
        )

        self.max_retry = 3
        self.retry_delays = [1, 2, 4]

        logger.info(
            f"Gemini Embedding initialized "
            f"(model={self.model_name}, batch_size={self.max_batch_size})"
        )

    def construct_embedding_text(self, title: str, abstract: str) -> str:
        return f"{title}\n\n{abstract}"

    def construct_query_text(self, query: str) -> str:
        return query.strip()

    def encode_text(self, text: str):
        """
        Generate embedding for one text.
        """

        if not text or not text.strip():
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
                        f"Single embedding failed "
                        f"(Retry {attempt+1}/{self.max_retry}) "
                        f"Waiting {wait}s. Error: {e}"
                    )

                    time.sleep(wait)

                else:

                    logger.error(
                        f"Single embedding failed after retries: {e}"
                    )

                    return None

    def encode_batch(
        self,
        texts: list[str],
    ) -> tuple[np.ndarray, list[int]]:
        """
        Generate embeddings using Gemini's native batch API.

        Returns
        -------
        (embeddings, successful_indices)
        """

        if not texts:
            return np.array([]), []

        valid_inputs = [
            (idx, text)
            for idx, text in enumerate(texts)
            if text and text.strip()
        ]

        if not valid_inputs:
            logger.warning("No valid texts supplied for embedding.")
            return np.array([]), []

        all_embeddings = []
        successful_indices = []

        for start in range(0, len(valid_inputs), self.max_batch_size):

            chunk = valid_inputs[start:start + self.max_batch_size]

            chunk_indices = [idx for idx, _ in chunk]
            chunk_texts = [text for _, text in chunk]

            success = False

            for attempt in range(self.max_retry):

                try:

                    response = self.client.models.embed_content(
                        model=self.model_name,
                        contents=chunk_texts,
                    )

                    if len(response.embeddings) != len(chunk_texts):
                        raise ValueError(
                            f"Expected {len(chunk_texts)} embeddings "
                            f"but received {len(response.embeddings)}."
                        )

                    vectors = [
                        np.array(item.values)
                        for item in response.embeddings
                    ]

                    all_embeddings.extend(vectors)
                    successful_indices.extend(chunk_indices)

                    logger.info(
                        f"Embedded {len(vectors)} papers "
                        f"in one Gemini batch request."
                    )

                    success = True
                    break

                except Exception as e:

                    if attempt < self.max_retry - 1:

                        wait = self.retry_delays[attempt]

                        logger.warning(
                            f"Batch embedding failed "
                            f"(Retry {attempt+1}/{self.max_retry}) "
                            f"Waiting {wait}s. Error: {e}"
                        )

                        time.sleep(wait)

                    else:

                        logger.error(
                            f"Batch embedding failed after retries: {e}"
                        )

            if not success:

                logger.info(
                    "Falling back to individual embedding."
                )

                for idx, text in chunk:

                    vector = self.encode_text(text)

                    if vector is not None:
                        all_embeddings.append(vector)
                        successful_indices.append(idx)

        if not all_embeddings:

            logger.warning(
                "No embeddings generated."
            )

            return np.array([]), []

        logger.info(
            f"Embedding complete. "
            f"Generated {len(all_embeddings)} embeddings."
        )

        return np.array(all_embeddings), successful_indices