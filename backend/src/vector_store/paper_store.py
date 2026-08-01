import json

import chromadb

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG, CHROMA_DB_PATH
from backend.src.ml_pipeline.embedder import PaperEmbedder


class VectorStoreManager:
    """
    Persistent Vector Storage Layer — the SOLE owner of ChromaDB access
    for paper-level (title+abstract) search.

    Responsibilities:
    -----------------
    - Generate document embeddings via PaperEmbedder (text -> vector).
    - Persist embeddings + normalized metadata into ChromaDB.
    - Run similarity queries against the collection.

    No other module should talk to ChromaDB directly for paper search —
    keeping all reads/writes here means there is exactly one place that
    understands the collection's schema (metadata keys, id scheme, etc).
    """

    def __init__(self):
        """Initializes the persistent ChromaDB client, collection, and embedder."""

        self.collection_name = (
            CONFIG.get("database", {}).get("collection_name", "academic_papers")
        )

        try:
            logger.info(f"Connecting to persistent ChromaDB at: {CHROMA_DB_PATH}")

            self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )

            self.embedder = PaperEmbedder()

            logger.info(
                f"Vector collection '{self.collection_name}' initialized successfully."
            )

        except Exception as e:
            logger.exception(f"Failed to initialize VectorStoreManager: {e}")
            raise

    # Storage
   
    def upsert_papers(self, papers: list, ai_analysis: list) -> list:
        """
        Embeds and stores papers, merged with their AI-generated analysis.

        Parameters
        ----------
        papers : list
            Normalized paper dicts from fetch_paper.py (must include at
            least paper_id, title, abstract, authors, year, url, pdf_url,
            source).
        ai_analysis : list
            Per-paper analysis dicts (same length/order as `papers`),
            each containing summary, keywords, difficulty_level — as
            produced by PaperAnalyzer.analyze_papers_batch.

        Returns
        -------
        list
            The enriched paper records that were actually stored (papers
            whose embedding failed are skipped and excluded here).
        """

        if not papers:
            logger.warning("VectorStore received an empty paper list. Skipping storage.")
            return []

        if len(papers) != len(ai_analysis):
            logger.warning(
                f"Paper count ({len(papers)}) does not match analysis count "
                f"({len(ai_analysis)}). Truncating to the shorter length to "
                f"avoid mismatched pairing."
            )

        pair_count = min(len(papers), len(ai_analysis))
        papers = papers[:pair_count]
        ai_analysis = ai_analysis[:pair_count]

        try:
            logger.info(f"Preparing {len(papers)} papers for vectorization.")

            documents = [
                self.embedder.construct_embedding_text(
                    paper.get("title", ""), paper.get("abstract", "")
                )
                for paper in papers
            ]

            embeddings, successful_indices = self.embedder.encode_batch(documents)

            if not successful_indices:
                logger.error("No embeddings were successfully generated. Aborting upsert.")
                return []

            # Keep only the papers/analysis/documents whose embedding succeeded,
            # so everything stays aligned by position.
            papers = [papers[i] for i in successful_indices]
            ai_analysis = [ai_analysis[i] for i in successful_indices]
            documents = [documents[i] for i in successful_indices]

            ids = [str(paper.get("paper_id") or paper.get("id")) for paper in papers]

            metadatas = []
            enriched_records = []

            for paper, analysis in zip(papers, ai_analysis):

                authors = paper.get("authors", "")
                if isinstance(authors, list):
                    authors = ", ".join(authors)

                metadata = {
                    "title": paper.get("title", "Unknown"),
                    "authors": str(authors),
                    "year": str(paper.get("year", "Unknown")),
                    "url": paper.get("url", ""),
                    "pdf_url": paper.get("pdf_url") or "",
                    "abstract": paper.get("abstract", ""),
                    "summary": analysis.get("summary", ""),
                    "keywords": json.dumps(analysis.get("keywords", [])),
                    "difficulty_level": analysis.get("difficulty_level", "Intermediate"),
                    "source": paper.get("source", "unknown"),
                }
                metadatas.append(metadata)

                enriched_records.append({
                    "id": paper.get("paper_id") or paper.get("id"),
                    "title": metadata["title"],
                    "authors": metadata["authors"],
                    "year": metadata["year"],
                    "url": metadata["url"],
                    "pdf_url": metadata["pdf_url"],
                    "abstract": metadata["abstract"],
                    "summary": metadata["summary"],
                    "keywords": analysis.get("keywords", []),
                    "difficulty_level": metadata["difficulty_level"],
                    "source_type": metadata["source"],
                })

            logger.info(f"Upserting {len(ids)} vectors into ChromaDB...")

            self.collection.upsert(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=documents,
                metadatas=metadatas,
            )

            logger.info("Database synchronization completed successfully.")
            logger.info(f"Current collection size: {self.collection.count()} documents.")

            return enriched_records

        except Exception as e:
            logger.exception(f"Vector database upsert operation failed: {e}")
            raise


    # Search
  
    def query_similar(self, query_vector, n_results: int = 10):
        """
        Runs a similarity search against the collection.

        Parameters
        ----------
        query_vector : np.ndarray or list
            The embedding vector to search with.
        n_results : int
            Max number of results to retrieve.

        Returns
        -------
        dict or None
            Raw ChromaDB query result (ids, documents, metadatas, distances),
            or None if the query fails or the collection is empty. Callers
            are responsible for applying similarity thresholds, sorting,
            and pagination — this method only fetches.
        """
        try:
            db_count = self.collection.count()

            if db_count == 0:
                logger.info("Vector collection is empty — skipping similarity query.")
                return None

            vector_list = (
                query_vector.tolist()
                if hasattr(query_vector, "tolist")
                else query_vector
            )

            results = self.collection.query(
                query_embeddings=[vector_list],
                n_results=min(db_count, n_results),
                include=["documents", "metadatas", "distances"],
            )

            return results

        except Exception as e:
            logger.exception(f"Vector similarity query failed: {e}")
            return None

    def get_by_id(self, paper_id: str):
        """
        Fetches a single stored paper (with its embedding) by id.

        Returns
        -------
        dict or None
            Raw ChromaDB get() result, or None if not found / on failure.
        """
        try:
            result = self.collection.get(
                ids=[paper_id],
                include=["documents", "metadatas", "embeddings"],
            )

            if not result["ids"]:
                return None

            return result

        except Exception as e:
            logger.exception(f"Failed to fetch paper '{paper_id}' by id: {e}")
            return None

    def exists(self, paper_id: str) -> bool:
        """Checks whether a paper_id is already stored, without fetching full data."""
        try:
            result = self.collection.get(ids=[paper_id])
            return bool(result["ids"])
        except Exception as e:
            logger.exception(f"Failed to check existence of paper '{paper_id}': {e}")
            return False

    def get_collection_size(self) -> int:
        """Returns the current number of indexed documents."""
        try:
            return self.collection.count()
        except Exception as e:
            logger.exception(f"Unable to retrieve collection statistics: {e}")
            return 0