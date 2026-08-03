import json
import chromadb
from chromadb.config import Settings
from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG, CHROMA_DB_PATH
from backend.src.ml_pipeline.embedder import PaperEmbedder


class VectorStoreManager:

    def __init__(self):
        """Initializes the persistent ChromaDB client, collection, and embedder."""
        self.collection_name = (
            CONFIG.get("database", {}).get("collection_name", "academic_papers")
        )

        try:
            logger.info(f"Connecting to persistent ChromaDB at: {CHROMA_DB_PATH}")

            # Explicit persistent settings for ChromaDB
            self.chroma_client = chromadb.PersistentClient(
                path=str(CHROMA_DB_PATH),
                settings=Settings(
                    allow_reset=True,
                    anonymized_telemetry=False,
                    is_persistent=True,
                ),
            )

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

    
    # Standardized Helpers (DRY & Robust Validation)
   

    def _build_metadata_and_record(self, paper: dict, analysis: dict) -> tuple[dict, dict]:
        """Constructs standardized Chroma metadata and frontend response record from new inputs."""
        raw_id = paper.get("paper_id") or paper.get("id")
        if not raw_id:
            raise ValueError("Cannot build metadata for a paper with a missing or null ID.")
        
        p_id = str(raw_id)
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

        record = self._build_record_from_metadata(metadata, p_id)
        return metadata, record

    def _build_record_from_metadata(self, meta: dict, p_id: str) -> dict:
        """Reconstructs standard frontend record directly from stored ChromaDB metadata dictionary."""
        if not p_id:
            raise ValueError("Cannot construct record without a valid paper ID.")

        keywords_data = meta.get("keywords", "[]")
        if isinstance(keywords_data, str):
            try:
                parsed_keywords = json.loads(keywords_data)
            except Exception:
                parsed_keywords = []
        else:
            parsed_keywords = keywords_data

        return {
            "id": p_id,
            "title": meta.get("title", "Unknown"),
            "authors": meta.get("authors", ""),
            "year": meta.get("year", "Unknown"),
            "url": meta.get("url", ""),
            "pdf_url": meta.get("pdf_url", ""),
            "abstract": meta.get("abstract", ""),
            "summary": meta.get("summary", ""),
            "keywords": parsed_keywords,
            "difficulty_level": meta.get("difficulty_level", "Intermediate"),
            "source_type": meta.get("source", "unknown"),
        }

    
    # Optimized Storage & Pre-Gemini Filtering Architecture
    

    def filter_existing_papers(self, papers: list) -> tuple[list, list]:
        """
        Filters out papers that already exist in ChromaDB in a SINGLE database query
        before running expensive Gemini summaries.
        
        Returns:
            (new_papers_to_process, already_cached_enriched_records)
        """
        if not papers:
            return [], []

        valid_papers = []
        raw_ids = []

        # Strict upfront ID validation
        for paper in papers:
            p_id = paper.get("paper_id") or paper.get("id")
            if not p_id:
                title_preview = paper.get("title", "Unknown")[:30]
                logger.warning(f"Paper skipped due to missing ID. Title: '{title_preview}...'")
                continue
            raw_ids.append(str(p_id))
            valid_papers.append(paper)

        if not raw_ids:
            return [], []

        try:
            # Single batch query fetching all relevant metadata upfront (No N+1 queries)
            existing_db_records = self.collection.get(ids=raw_ids, include=["metadatas"])
            
            existing_ids = existing_db_records.get("ids", []) if existing_db_records else []
            existing_metas = existing_db_records.get("metadatas", []) if existing_db_records else []

            # Hashmap lookup for O(1) in-memory record building
            existing_meta_map = {
                pid: meta for pid, meta in zip(existing_ids, existing_metas) if meta
            }

            new_papers = []
            cached_records = []

            for paper in valid_papers:
                p_id = str(paper.get("paper_id") or paper.get("id"))
                if p_id in existing_meta_map:
                    # Construct record in-memory via helper
                    meta = existing_meta_map[p_id]
                    cached_record = self._build_record_from_metadata(meta, p_id)
                    cached_records.append(cached_record)
                else:
                    new_papers.append(paper)

            logger.info(
                f"Pre-Gemini Filter: {len(new_papers)} new papers to summarize/embed, "
                f"{len(cached_records)} existing papers served directly from cache."
            )
            return new_papers, cached_records

        except Exception as e:
            logger.exception(f"Failed during pre-filtering existing papers: {e}")
            # Safe Fallback: Process all valid papers as new if query fails
            return valid_papers, []

    def upsert_papers(self, papers: list, ai_analysis: list) -> list:
        """
        Receives ONLY newly generated papers and their summaries, 
        performs native batch embedding, and upserts them into ChromaDB.
        """
        if not papers or not ai_analysis:
            return []

        if len(papers) != len(ai_analysis):
            logger.warning(
                f"Paper count ({len(papers)}) does not match analysis count "
                f"({len(ai_analysis)}). Truncating to shorter length."
            )
            pair_count = min(len(papers), len(ai_analysis))
            papers = papers[:pair_count]
            ai_analysis = ai_analysis[:pair_count]

        try:
            logger.info(f"Preparing {len(papers)} newly analyzed papers for batch embedding.")

            # Step 1: Build embedding documents text representation
            documents = [
                self.embedder.construct_embedding_text(
                    paper.get("title", ""), paper.get("abstract", "")
                )
                for paper in papers
            ]

            # Step 2: Native batch embedding call via Gemini API
            embeddings, successful_indices = self.embedder.encode_batch(documents)

            if not successful_indices:
                logger.error("Embedding generation failed entirely for new batch.")
                return []

            if len(successful_indices) < len(papers):
                logger.warning(
                    f"Partial embedding failure: {len(papers) - len(successful_indices)} papers dropped."
                )

            # Keep aligned list elements
            papers = [papers[i] for i in successful_indices]
            ai_analysis = [ai_analysis[i] for i in successful_indices]
            documents = [documents[i] for i in successful_indices]

            ids = []
            metadatas = []
            enriched_records = []

            for paper, analysis in zip(papers, ai_analysis):
                metadata, record = self._build_metadata_and_record(paper, analysis)
                ids.append(record["id"])
                metadatas.append(metadata)
                enriched_records.append(record)

            # Step 3: Pure insert/upsert for brand new papers
            logger.info(f"Upserting {len(ids)} new vector records into ChromaDB...")
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=documents,
                metadatas=metadatas,
            )

            logger.info(f"Database sync complete. Total collection size: {self.collection.count()}")
            return enriched_records

        except Exception as e:
            logger.exception(f"Vector database upsert operation failed: {e}")
            raise

    
    # Query & Retrieval Utilities
   

    def query_similar(self, query_vector, n_results: int = 10):
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
        try:
            result = self.collection.get(
                ids=[paper_id],
                include=["documents", "metadatas", "embeddings"],
            )
            if not result.get("ids"):
                return None
            return result
        except Exception as e:
            logger.exception(f"Failed to fetch paper '{paper_id}' by id: {e}")
            return None

    def exists(self, paper_id: str) -> bool:
        try:
            result = self.collection.get(ids=[paper_id], include=[])
            return bool(result.get("ids"))
        except Exception as e:
            logger.exception(f"Failed to check existence of paper '{paper_id}': {e}")
            return False

    def get_collection_size(self) -> int:
        try:
            return self.collection.count()
        except Exception as e:
            logger.exception(f"Unable to retrieve collection statistics: {e}")
            return 0