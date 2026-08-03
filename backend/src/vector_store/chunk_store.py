import chromadb

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG, CHROMA_DB_PATH
from backend.src.ml_pipeline.embedder import PaperEmbedder


class ChunkStoreManager:
    """
    Persistent Vector Storage Layer for RAG — stores and searches
    paper-CHUNK-level embeddings.


    """

    def __init__(self):
        self.collection_name = CONFIG.get("rag", {}).get(
            "chunk_collection_name", "paper_chunks"
        )

        try:
            logger.info(f"Connecting to persistent ChromaDB at: {CHROMA_DB_PATH}")

            self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )

            self.embedder = PaperEmbedder()

            logger.info(f"Chunk collection '{self.collection_name}' initialized successfully.")

        except Exception as e:
            logger.exception(f"Failed to initialize ChunkStoreManager: {e}")
            raise

    # Existence check — this is what avoids re-processing the same paper
    
    def has_chunks(self, paper_id: str) -> bool:
        """Checks whether chunks for this paper are already stored."""
        try:
            result = self.collection.get(where={"paper_id": paper_id}, limit=1)
            return bool(result["ids"])
        except Exception as e:
            logger.exception(f"Failed to check chunk existence for paper '{paper_id}': {e}")
            return False


    # Storage
    
    def store_chunks(self, chunks: list) -> bool:
        """
        Embeds and stores a list of chunk dicts (as produced by TextChunker).

        Returns
        -------
        bool
            True if at least some chunks were stored successfully,
            False if nothing could be stored.
        """
        if not chunks:
            logger.warning("store_chunks called with an empty chunk list.")
            return False

        try:
            texts = [chunk["text"] for chunk in chunks]

            embeddings, successful_indices = self.embedder.encode_batch(texts)

            if not successful_indices:
                logger.error("No chunk embeddings were successfully generated.")
                return False

            stored_chunks = [chunks[i] for i in successful_indices]

            ids = [c["chunk_id"] for c in stored_chunks]
            documents = [c["text"] for c in stored_chunks]
            metadatas = [
                {"paper_id": c["paper_id"], "chunk_index": c["chunk_index"]}
                for c in stored_chunks
            ]

            self.collection.upsert(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=documents,
                metadatas=metadatas,
            )

            logger.info(
                f"Stored {len(ids)} / {len(chunks)} chunks for paper "
                f"'{stored_chunks[0]['paper_id']}'."
            )
            return True

        except Exception as e:
            logger.exception(f"Failed to store chunks: {e}")
            return False

  
    # Search — scoped to a single paper via the `where` filter
   
    def query_chunks(self, paper_id: str, query_vector, top_k: int = 5) -> list:
        """
        Retrieves the top_k most relevant chunks for a question, filtered
        to ONLY this paper's chunks. This `where` filter is what keeps
        chat answers grounded in the correct paper, even though all
        papers' chunks live in the same collection.

        Returns
        -------
        list[str]
            Chunk texts ordered by relevance (most relevant first).
            Empty list if nothing found or on failure.
        """
        try:
            vector_list = (
                query_vector.tolist() if hasattr(query_vector, "tolist") else query_vector
            )

            results = self.collection.query(
                query_embeddings=[vector_list],
                n_results=top_k,
                where={"paper_id": paper_id},
                include=["documents", "distances"],
            )

            if not results.get("documents") or not results["documents"][0]:
                return []

            return results["documents"][0]

        except Exception as e:
            logger.exception(f"Chunk query failed for paper '{paper_id}': {e}")
            return []

   
    # Maintenance
 
    def delete_chunks(self, paper_id: str) -> None:
        """Removes all stored chunks for a paper (e.g. to force re-processing after a bad extraction)."""
        try:
            self.collection.delete(where={"paper_id": paper_id})
            logger.info(f"Deleted chunks for paper '{paper_id}'.")
        except Exception as e:
            logger.exception(f"Failed to delete chunks for paper '{paper_id}': {e}")