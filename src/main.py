import json
import time
from src.common.logger import logger
from src.common.config_loader import CONFIG
from src.common.config_loader import CHROMA_DB_PATH
from src.ingestion.fetch_paper import SemanticScholarClient, ArxivClient
from src.ml_pipeline.embedder import PaperEmbedder
from src.ml_pipeline.llm_analyzer import PaperAnalyzer

import chromadb


class ResearchPlatformOrchestrator:
    def __init__(self):
        """Initializes all sub-modules inside the central backend orchestrator engine."""

        logger.info("Initializing Symmetrical Dual-Source Research Platform...")

        self.max_results = int(CONFIG.get("search", {}).get("default_max_results", 15))
        self.collection_name = CONFIG.get("embedding", {}).get("collection_name", "academic_papers")
        self.threshold = float(CONFIG.get("embedding", {}).get("similarity_threshold", 0.5))

        # New API extraction engine integrations
        self.semantic_scholar = SemanticScholarClient()
        self.arxiv_client = ArxivClient()

        self.embedder = PaperEmbedder()
        self.llm_analyzer = PaperAnalyzer()

        self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info("Orchestration loop successfully initialized.")

    def run_pipeline(self, user_query: str, offset: int = 0):
        """
        Master hybrid orchestration loop utilizing Intent Extraction,
        Vector Caching, and Dual-Source Smart Routing sorted by Beginner difficulty.
        """
        query_clean = user_query.strip()
        if not query_clean:
            logger.warning("No query text provided to the pipeline.")
            return []

        logger.info(f"Orchestration loop triggered for query: '{query_clean}'")

        # 1. Intent Extraction: Analyze user query and extract clean intent
        search_data = self.llm_analyzer.extract_search(query_clean)

        search_query = search_data["search_query"]

        # 2. Symmetrical Cache Guard: Check local ChromaDB using the clean core topic parameters

        # Difficulty sorting weight lookup map
        difficulty_order = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}

        # 3. Vector Cache Guard: Check local ChromaDB using the clean core topic parameters
        query_text = self.embedder.construct_query_text(
            search_query
        )

        query_vector = self.embedder.encode_text(
            query_text
        )

        db_count = self.collection.count()
        cache_hit_papers = []

        if db_count > 0:
            results = self.collection.query(
                query_embeddings=[query_vector],
                n_results=min(db_count, 50),
                include=["documents", "metadatas", "distances"]
            )

            if results["ids"] and results["ids"][0]:
                for idx, distance in enumerate(results["distances"][0]):
                    similarity_score = 1.0 - distance

                    # Evaluate structural similarity metric matching the guardrail
                    if similarity_score >= self.threshold:
                        meta = results["metadatas"][0][idx]
                        doc_text = results["documents"][0][idx]

                        keywords_raw = meta.get("keywords", "[]")
                        try:
                            keywords_list = json.loads(keywords_raw)
                        except Exception:
                            keywords_list = [k.strip() for k in keywords_raw.split(",")]

                        paper_data = {
                            "id": results["ids"][0][idx],
                            "title": meta.get("title", ""),
                            "url": meta.get("url", ""),
                            "year": meta.get("year", "0000"),
                            "authors": meta.get("authors", ""),
                            "abstract": doc_text.split("Abstract:")[-1].strip() if "Abstract:" in doc_text else doc_text,
                            "summary": meta.get("summary", ""),
                            "keywords": keywords_list,
                            "difficulty_level": meta.get("difficulty_level", "Intermediate"),
                            "match_score": round(similarity_score, 4),
                            "source_type": "LOCAL_VECTOR_CACHE"
                        }
                        cache_hit_papers.append(paper_data)

        # Evaluate if cache collection successfully matched queries above threshold
        if cache_hit_papers:
            logger.info(f"[CACHE HIT] Returning {len(cache_hit_papers)} high-confidence matches from local vector database.")

            cache_hit_papers.sort(
                key=lambda x: difficulty_order.get(
                    x.get("difficulty_level", "Intermediate"), 1
                )
            )

            start = offset
            end = offset + 5

            return cache_hit_papers[start:end]

        # 3. Dynamic External Routing Matrix: [CACHE MISS PATH]
        logger.info("[CACHE MISS] Querying primary channel: Semantic Scholar.")
        raw_fetched_papers = self.semantic_scholar.fetch_papers(
            query=search_query,
            limit=5,
            offset=offset
        )

        if not raw_fetched_papers:
            logger.warning("Primary source empty or failed. Activating word-level arXiv fallback path.")
            raw_fetched_papers = self.arxiv_client.fetch_papers(
                query=search_query,
                limit=5,
                offset=offset
            )

        if not raw_fetched_papers:
            logger.error("No relevant research papers located across all global repositories.")
            return []

        enriched_pipeline_records = []

        batch_result = self.llm_analyzer.analyze_papers_batch(
            raw_fetched_papers
        )

        used_gemini = batch_result["used_gemini"]

        batch_analysis = batch_result["analysis"]

        # 4. Ingestion & Storage Sync Loop
        for paper, ai_telemetry in zip(
            raw_fetched_papers,
            batch_analysis
        ):
            try:
                enriched_record = {
                    "id": paper["paper_id"],
                    "title": paper["title"],
                    "url": paper["url"],
                    "authors": paper["authors"],
                    "year": paper["year"],
                    "abstract": paper["abstract"],
                    "summary": ai_telemetry["summary"],
                    "keywords": ai_telemetry["keywords"],
                    "difficulty_level": ai_telemetry["difficulty_level"],
                    "match_score": 1.0,
                    "source_type": paper["source"]
                }

                enriched_pipeline_records.append(enriched_record)

                # Maintain perfect structural data uniformity within ChromaDB
                combined_corpus_string = self.embedder.construct_embedding_text(paper["title"], paper["abstract"])
                paper_vector_array = self.embedder.encode_text(combined_corpus_string)

                existing = self.collection.get(
                    ids=[paper["paper_id"]]
                )

                if not existing["ids"]:
                    self.collection.upsert(
                        ids=[paper["paper_id"]],
                        embeddings=[paper_vector_array],
                        documents=[combined_corpus_string],
                        metadatas=[{
                            "title": paper["title"],
                            "authors": paper.get("authors", ""),
                            "url": paper["url"],
                            "year": str(paper["year"]),
                            "abstract": paper["abstract"],
                            "summary": ai_telemetry["summary"],
                            "difficulty_level": ai_telemetry["difficulty_level"],
                            "keywords": json.dumps(ai_telemetry["keywords"])
                        }]
                    )
            except Exception as paper_err:
                logger.error(f"Skipping individual paper enrichment mapping error: {paper_err}")
                continue

        enriched_pipeline_records.sort(key=lambda x: difficulty_order.get(x.get("difficulty_level", "Intermediate"), 1))

        return enriched_pipeline_records

    def get_paper_details(self, paper_id: str):
        """
        Returns one paper along with similar paper recommendations.
        """

        try:
            result = self.collection.get(
                ids=[paper_id],
                include=["documents", "metadatas", "embeddings"]
            )

            if not result["ids"]:
                return None

            metadata = result["metadatas"][0]
            embedding = result["embeddings"][0]
            document = result["documents"][0]

            try:
                keywords = json.loads(metadata.get("keywords", "[]"))
            except Exception:
                keywords = []

            paper = {
                "id": paper_id,
                "title": metadata.get("title", ""),
                "authors": metadata.get("authors", ""),
                "year": metadata.get("year", ""),
                "url": metadata.get("url", ""),
                "summary": metadata.get("summary", ""),
                "difficulty_level": metadata.get("difficulty_level", ""),
                "keywords": keywords,
                "abstract": metadata.get("abstract", "")
            }

            recommendation_result = self.collection.query(
                query_embeddings=[embedding],
                n_results=6,
                include=["documents", "metadatas", "distances"]
            )

            recommendations = []

            for idx, rec_id in enumerate(recommendation_result["ids"][0]):

                if rec_id == paper_id:
                    continue

                meta = recommendation_result["metadatas"][0][idx]
                doc = recommendation_result["documents"][0][idx]

                recommendations.append({
                    "id": rec_id,
                    "title": meta.get("title", ""),
                    "authors": meta.get("authors", ""),
                    "year": meta.get("year", ""),
                    "url": meta.get("url", ""),
                    "summary": meta.get("summary", ""),
                    "difficulty_level": meta.get("difficulty_level", ""),
                    "keywords": json.loads(meta.get("keywords", "[]")),
                    "abstract": meta.get("abstract", "")
                })

            return {
                "paper": paper,
                "recommendations": recommendations[:5]
            }

        except Exception as e:
            logger.error(f"Paper detail fetch failed: {e}")
            return None


if __name__ == "__main__":
    orchestrator = ResearchPlatformOrchestrator()
    print("Welcome to the Master Terminal Research Platform Backend Loop Interface")
    user_search_topic = input("Enter topic query text description: ")
    res = orchestrator.run_pipeline(user_search_topic)
    print(f"\n[SYSTEM] Done! Processed output package payload.")