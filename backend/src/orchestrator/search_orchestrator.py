import json

import numpy as np

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG
from backend.src.ingestion.fetch_paper import SemanticScholarClient, ArxivClient
from backend.src.ml_pipeline.llm_analyzer import PaperAnalyzer
from backend.src.vector_store.paper_store import VectorStoreManager
from backend.src.orchestrator.search_session_store import SearchSessionStore

PAGE_SIZE = 5


class ResearchPlatformOrchestrator:
    """
    Central coordinator for the search pipeline.
    """

    def __init__(self):
        logger.info("Initializing Research Platform Orchestrator...")

        self.pool_size = int(CONFIG.get("search", {}).get("default_max_results", 15))
        self.threshold = float(CONFIG.get("search", {}).get("similarity_threshold", 0.5))

        self.semantic_scholar = SemanticScholarClient()
        self.arxiv_client = ArxivClient()
        self.llm_analyzer = PaperAnalyzer()

        # VectorStoreManager owns its own PaperEmbedder instance internally;
        # we reuse it (self.vector_store.embedder) rather than creating a
        # second Gemini client for query embedding.
        self.vector_store = VectorStoreManager()

        self.session_store = SearchSessionStore()

        logger.info("Orchestrator initialized successfully.")

    # Public API
  
    def start_search(self, topic: str, description: str = "") -> dict:
        """
        Runs a new search: builds the full ranked pool once, returns the
        first page (summarized), and stores the pool for later pagination.

        Returns
        -------
        dict
            {
                "search_id": str or None,
                "results": list[dict],      # first page, up to PAGE_SIZE
                "has_more": bool,
                "total_pool_size": int,
            }
        """
        topic = (topic or "").strip()

        if not topic:
            logger.warning("start_search called with an empty topic.")
            return {"search_id": None, "results": [], "has_more": False, "total_pool_size": 0}

        logger.info(f"Starting search for topic: '{topic}'")

        query_data = self.llm_analyzer.extract_search(topic, description)

        pool = self._build_pool(
            raw_topic=topic,
            semantic_query=query_data["semantic_query"],
            keyword_query=query_data["keyword_query"],
            field_of_study=query_data["field_of_study"],
        )

        search_id = self.session_store.create(pool, query_meta=query_data)

        page = self._get_page_with_summaries(pool, start=0, count=PAGE_SIZE)

        return {
            "search_id": search_id,
            "results": page,
            "has_more": len(pool) > PAGE_SIZE,
            "total_pool_size": len(pool),
        }

    def load_more(self, search_id: str, current_count: int) -> dict:
        """
        Returns the next page of an existing search pool.

        Parameters
        ----------
        search_id : str
            The id returned by start_search().
        current_count : int
            How many results the frontend has already shown (i.e. the
            slice offset to continue from).

        Returns
        -------
        dict
            {"results": list[dict], "has_more": bool, "expired": bool}
        """
        pool = self.session_store.get_pool(search_id)

        if pool is None:
            logger.warning(f"load_more called with expired/unknown search_id '{search_id}'.")
            return {"results": [], "has_more": False, "expired": True}

        page = self._get_page_with_summaries(pool, start=current_count, count=PAGE_SIZE)

        return {
            "results": page,
            "has_more": (current_count + PAGE_SIZE) < len(pool),
            "expired": False,
        }

    def get_paper_details(self, paper_id: str):
        """Returns one paper's full detail plus similar-paper recommendations."""
        try:
            result = self.vector_store.get_by_id(paper_id)

            if result is None:
                return None

            metadata = result["metadatas"][0]
            embedding = result["embeddings"][0]
            document = result["documents"][0]

            paper = self._metadata_to_paper_dict(paper_id, metadata, fallback_abstract=document)

            rec_results = self.vector_store.query_similar(embedding, n_results=6)
            recommendations = []

            if rec_results and rec_results.get("ids") and rec_results["ids"][0]:
                for idx, rec_id in enumerate(rec_results["ids"][0]):
                    if rec_id == paper_id:
                        continue

                    meta = rec_results["metadatas"][0][idx]
                    recommendations.append(self._metadata_to_paper_dict(rec_id, meta))

            return {"paper": paper, "recommendations": recommendations[:5]}

        except Exception as e:
            logger.error(f"Paper detail fetch failed: {e}")
            return None

  
    # Pool construction (runs once per search)
    def _build_pool(self, raw_topic: str, semantic_query: str, keyword_query: str, field_of_study) -> list:
        """
        Builds the ranked candidate pool: qualifying cache matches first
        (already summarized — free), then freshly-fetched external papers
        filling any remaining slots up to self.pool_size.

        Summaries for external papers are intentionally NOT generated
        here. That happens lazily in _get_page_with_summaries.

        NOTE: keyword_query is currently unused — external search now
        uses raw_topic directly (see _collect_external_matches). Kept as
        a parameter rather than removing it from the query_enhancer
        pipeline, in case a future use case needs it again.
        """
        embedder = self.vector_store.embedder
        query_vector = embedder.encode_text(embedder.construct_query_text(semantic_query))

        pool = []
        seen_ids = set()

        if query_vector is not None:
            pool.extend(self._collect_cache_matches(query_vector, seen_ids))
        else:
            logger.warning("Query embedding failed — skipping cache lookup, going external only.")

        remaining = self.pool_size - len(pool)

        if remaining > 0:
            pool.extend(
                self._collect_external_matches(raw_topic, query_vector, field_of_study, remaining, seen_ids)
            )

        logger.info(f"Final pool built with {len(pool)} papers ({len(seen_ids)} unique ids).")
        return pool

    def _collect_cache_matches(self, query_vector, seen_ids: set) -> list:
        """Queries the vector cache and returns qualifying entries above the similarity threshold."""
        entries = []

        cache_results = self.vector_store.query_similar(query_vector, n_results=self.pool_size)

        if not cache_results or not cache_results.get("ids") or not cache_results["ids"][0]:
            return entries

        for idx, distance in enumerate(cache_results["distances"][0]):
            similarity = 1.0 - distance
            if similarity < self.threshold:
                continue

            paper_id = cache_results["ids"][0][idx]
            if paper_id in seen_ids:
                continue

            meta = cache_results["metadatas"][0][idx]
            doc_text = cache_results["documents"][0][idx]

            try:
                keywords = json.loads(meta.get("keywords", "[]"))
            except Exception:
                keywords = []

            entries.append({
                "paper_id": paper_id,
                "title": meta.get("title", ""),
                "abstract": meta.get("abstract") or doc_text,
                "authors": meta.get("authors", ""),
                "year": meta.get("year", "Unknown"),
                "url": meta.get("url", ""),
                "pdf_url": meta.get("pdf_url", ""),
                "source": meta.get("source", "unknown"),
                "match_score": round(similarity, 4),
                "summary": meta.get("summary") or None,
                "keywords": keywords or None,
                "difficulty_level": meta.get("difficulty_level") or None,
                "from_cache": True,
            })
            seen_ids.add(paper_id)

        logger.info(f"Cache supplied {len(entries)} qualifying papers.")
        return entries

    def _collect_external_matches(self, raw_topic, query_vector, field_of_study, needed: int, seen_ids: set) -> list:
        """
        Fetches from Semantic Scholar (primary) then arXiv (fallback),
        OVER-FETCHING a larger candidate pool than `needed` in a SINGLE
        call, then re-ranking those candidates by embedding similarity
        to the user's full semantic intent before picking the top ones.

        """
        over_fetch_count = min(needed * 2, 30)

        logger.info(
            f"Fetching up to {over_fetch_count} candidates externally for query: '{raw_topic}'"
        )

        raw_papers = self.semantic_scholar.fetch_papers(
            query=raw_topic, limit=over_fetch_count, offset=0, field_of_study=field_of_study
        )

        if not raw_papers:
            logger.warning(f"Semantic Scholar returned nothing for '{raw_topic}'. Falling back to arXiv.")
            raw_papers = self.arxiv_client.fetch_papers(query=raw_topic, limit=over_fetch_count, offset=0)

        candidates = [
            paper for paper in raw_papers
            if paper.get("paper_id") and paper["paper_id"] not in seen_ids
        ]

        if not candidates:
            return []

        # If we don't have a query vector to rerank against (embedding
        # failed earlier), just take the external source's own order —
        # degraded but not broken.
        if query_vector is None:
            return self._candidates_to_entries(candidates[:needed], seen_ids)

        embedder = self.vector_store.embedder
        texts = [
            embedder.construct_embedding_text(paper.get("title", ""), paper.get("abstract", ""))
            for paper in candidates
        ]

        embeddings, successful_indices = embedder.encode_batch(texts)

        if not successful_indices:
            logger.warning("Candidate embedding failed entirely — falling back to external source's own order.")
            return self._candidates_to_entries(candidates[:needed], seen_ids)

        scored = []
        for row_idx, candidate_idx in enumerate(successful_indices):
            similarity = self._cosine_similarity(query_vector, embeddings[row_idx])
            scored.append((candidate_idx, similarity))

        # Highest semantic similarity to the user's full intent first.
        scored.sort(key=lambda pair: pair[1], reverse=True)

        top_candidates = [(candidates[idx], score) for idx, score in scored[:needed]]

        return self._candidates_to_entries(top_candidates, seen_ids)

    def _candidates_to_entries(self, candidates, seen_ids: set) -> list:
        """
        Converts raw external paper dicts into pool entries.

        Accepts either a plain list of paper dicts (no rerank score
        available) or a list of (paper_dict, similarity_score) tuples.
        """
        entries = []

        for item in candidates:
            if isinstance(item, tuple):
                paper, score = item
            else:
                paper, score = item, None

            paper_id = paper.get("paper_id")
            if not paper_id or paper_id in seen_ids:
                continue

            entries.append({
                "paper_id": paper_id,
                "title": paper.get("title", ""),
                "abstract": paper.get("abstract", ""),
                "authors": paper.get("authors", ""),
                "year": paper.get("year", "Unknown"),
                "url": paper.get("url", ""),
                "pdf_url": paper.get("pdf_url"),
                "source": paper.get("source", "unknown"),
                "match_score": round(score, 4) if score is not None else None,
                "summary": None,
                "keywords": None,
                "difficulty_level": None,
                "from_cache": False,
            })
            seen_ids.add(paper_id)

        return entries

    @staticmethod
    def _cosine_similarity(vector_a, vector_b) -> float:
        """Cosine similarity between two vectors, safe against zero-norm edge cases."""
        a = np.asarray(vector_a, dtype=float)
        b = np.asarray(vector_b, dtype=float)

        denominator = np.linalg.norm(a) * np.linalg.norm(b)
        if denominator == 0:
            return 0.0

        return float(np.dot(a, b) / denominator)

  
    # Lazy, per-page summarization
   
    def _get_page_with_summaries(self, pool: list, start: int, count: int) -> list:
        """
        Returns pool[start:start+count]. Generates summaries ONLY for
        entries in this slice that don't already have one (cache-hit
        entries already do). Newly generated summaries are written back
        onto the pool in place, and newly-summarized external papers are
        persisted into the vector store so future searches get them for
        free from cache.

        This is what correctly handles the "mixed page" case: e.g. if a
        page of 5 has 3 cache-hit papers and 2 freshly-fetched ones, only
        those 2 go into the LLM batch call — not all 5.
        """
        slice_ = pool[start:start + count]

        if not slice_:
            return []

        to_analyze_indices = [i for i, p in enumerate(slice_) if p.get("summary") is None]

        if to_analyze_indices:
            raw_for_analysis = [slice_[i] for i in to_analyze_indices]

            logger.info(f"Generating summaries for {len(raw_for_analysis)} new papers in this page.")

            batch_result = self.llm_analyzer.analyze_papers_batch(raw_for_analysis)
            analysis_list = batch_result["analysis"]

            newly_stored_papers = []
            newly_stored_analysis = []

            for local_idx, analysis in zip(to_analyze_indices, analysis_list):
                slice_[local_idx]["summary"] = analysis.get("summary", "")
                slice_[local_idx]["keywords"] = analysis.get("keywords", [])
                slice_[local_idx]["difficulty_level"] = analysis.get("difficulty_level", "Intermediate")

                if not slice_[local_idx]["from_cache"]:
                    newly_stored_papers.append(slice_[local_idx])
                    newly_stored_analysis.append(analysis)

            if newly_stored_papers:
                try:
                    self.vector_store.upsert_papers(newly_stored_papers, newly_stored_analysis)
                except Exception as e:
                    logger.error(f"Failed to persist newly summarized papers to vector store: {e}")

        return slice_

   
    # Helpers

    @staticmethod
    def _metadata_to_paper_dict(paper_id: str, metadata: dict, fallback_abstract: str = "") -> dict:
        """Converts a ChromaDB metadata dict into the standard paper response shape."""
        try:
            keywords = json.loads(metadata.get("keywords", "[]"))
        except Exception:
            keywords = []

        return {
            "paper_id": paper_id,
            "title": metadata.get("title", ""),
            "authors": metadata.get("authors", ""),
            "year": metadata.get("year", ""),
            "url": metadata.get("url", ""),
            "pdf_url": metadata.get("pdf_url", ""),
            "summary": metadata.get("summary", ""),
            "difficulty_level": metadata.get("difficulty_level", ""),
            "source": metadata.get("source", "unknown"),
            "keywords": keywords,
            "abstract": metadata.get("abstract") or fallback_abstract,
        }


if __name__ == "__main__":
    orchestrator = ResearchPlatformOrchestrator()
    print("Welcome to the Research Platform Backend — standalone test mode")

    topic_input = input("Enter topic: ")
    description_input = input("Enter description (optional): ")

    first_page = orchestrator.start_search(topic_input, description_input)
    print(json.dumps(first_page, indent=2, default=str))

    if first_page["has_more"]:
        more = input("\nLoad next 5? (y/n): ")
        if more.strip().lower() == "y":
            next_page = orchestrator.load_more(first_page["search_id"], current_count=5)
            print(json.dumps(next_page, indent=2, default=str))