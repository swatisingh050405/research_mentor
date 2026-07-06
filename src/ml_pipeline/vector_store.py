import chromadb

from src.common.logger import logger
from src.common.config_loader import CONFIG, CHROMA_DB_PATH
from src.ml_pipeline.embedder import PaperEmbedder


class VectorStoreManager:
    """
    Persistent Vector Storage Layer.

    Responsibilities:
    -----------------
    • Generate document embeddings using the local embedding engine.
    • Persist embeddings into ChromaDB.
    • Store normalized metadata for downstream semantic retrieval.
    """

    def __init__(self):
        """Initializes the persistent ChromaDB client and collection."""

        self.collection_name = (
            CONFIG.get("database", {})
            .get("collection_name", "academic_papers")
        )

        try:
            logger.info(
                f"Connecting to persistent ChromaDB at: {CHROMA_DB_PATH}"
            )

            self.chroma_client = chromadb.PersistentClient(
                path=str(CHROMA_DB_PATH)
            )

            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )

            self.embedder = PaperEmbedder()

            logger.info(
                f"Vector collection '{self.collection_name}' initialized successfully."
            )

        except Exception as e:
            logger.exception(
                f"Failed to initialize VectorStoreManager: {e}"
            )
            raise

    def upsert_papers_to_db(self, papers: list):
        """
        Generates embeddings and stores research papers inside ChromaDB.

        Parameters
        ----------
        papers : list
            List containing normalized paper dictionaries.

        Expected Schema
        ----------------
        {
            "paper_id": "...",
            "title": "...",
            "abstract": "...",
            "authors": "...",
            "year": "...",
            "url": "...",
            "source": "semantic_scholar | arxiv"
        }
        """

        if not papers:
            logger.warning(
                "VectorStore received an empty paper list. Skipping storage."
            )
            return

        try:

            logger.info(
                f"Preparing {len(papers)} papers for vectorization."
            )

            documents = [
                self.embedder.construct_embedding_text(
                    paper.get("title", ""),
                    paper.get("abstract", "")
                )
                for paper in papers
            ]

            embeddings = self.embedder.encode_batch(documents)

            ids = [
                str(
                    paper.get("paper_id")
                    or paper.get("id")
                )
                for paper in papers
            ]

            metadatas = []

            for paper in papers:

                authors = paper.get("authors", "")

                if isinstance(authors, list):
                    authors = ", ".join(authors)

                metadatas.append({

                    "title": paper.get("title", "Unknown"),

                    "authors": str(authors),

                    "year": str(
                        paper.get("year", "Unknown")
                    ),

                    "url": paper.get(
                        "url",
                        paper.get("link", "")
                    ),

                    "abstract": paper.get(
                        "abstract",
                        ""
                    ),

                    "summary": paper.get(
                        "summary",
                        ""
                    ),

                    "source": paper.get(
                        "source",
                        "unknown"
                    )

                })

            logger.info(
                f"Upserting {len(ids)} vectors into ChromaDB..."
            )

            self.collection.upsert(

                ids=ids,

                embeddings=embeddings.tolist(),

                documents=documents,

                metadatas=metadatas

            )

            logger.info(
                f"Database synchronization completed successfully."
            )

            logger.info(
                f"Current collection size: {self.collection.count()} documents."
            )

        except Exception as e:

            logger.exception(
                f"Vector database upsert operation failed: {e}"
            )

            raise

    def get_collection_size(self) -> int:
        """
        Returns the current number of indexed documents.
        """

        try:
            return self.collection.count()

        except Exception as e:

            logger.exception(
                f"Unable to retrieve collection statistics: {e}"
            )

            return 0


if __name__ == "__main__":

    logger.info(
        "Initializing Vector Store standalone test."
    )

    try:

        vector_store = VectorStoreManager()

        logger.info(
            f"Current collection contains {vector_store.get_collection_size()} documents."
        )

    except Exception as e:

        logger.exception(
            f"Standalone VectorStore execution failed: {e}"
        )