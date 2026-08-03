from threading import Lock

from backend.src.core.logger import logger
from backend.src.ingestion.pdf_fetcher import PDFFetcher
from backend.src.ml_pipeline.chunker import TextChunker
from backend.src.ml_pipeline.llm_analyzer import PaperAnalyzer
from backend.src.vector_store.chunk_store import ChunkStoreManager
from backend.src.vector_store.paper_store import VectorStoreManager

TOP_K_CHUNKS = 5


class ChatOrchestrator:
   

    def __init__(self):
        logger.info("Initializing Chat Orchestrator...")

        self.pdf_fetcher = PDFFetcher()
        self.chunker = TextChunker()
        self.chunk_store = ChunkStoreManager()
        self.llm_analyzer = PaperAnalyzer()
 
        
        self.paper_store = VectorStoreManager()

        

        self._known_abstract_only = set()
        self._lock = Lock()

        logger.info("Chat Orchestrator initialized successfully.")

    # Public API
  
    def prepare_chat(self, paper_id: str) -> dict:
       
        paper = self._get_paper_metadata(paper_id)

        if paper is None:
            return {"context_mode": None, "paper_found": False}

        context_mode = self._ensure_chunks_ready(paper_id, paper.get("pdf_url", ""))
        return {"context_mode": context_mode, "paper_found": True}

    def ask(self, paper_id: str, question: str) -> dict:
        
        question = (question or "").strip()

        if not question:
            return {
                "answer": "Please ask a question about this paper.",
                "context_mode": None,
                "used_gemini": False,
                "paper_found": True,
            }

        paper = self._get_paper_metadata(paper_id)

        if paper is None:
            return {
                "answer": "This paper could not be found.",
                "context_mode": None,
                "used_gemini": False,
                "paper_found": False,
            }

        context_mode = self._ensure_chunks_ready(paper_id, paper.get("pdf_url", ""))
        context_chunks = self._retrieve_context(paper_id, question, context_mode, paper.get("abstract", ""))

        result = self.llm_analyzer.answer_paper_question(
            question=question,
            context_chunks=context_chunks,
            context_mode=context_mode,
            paper_title=paper.get("title", ""),
            paper_url=paper.get("url", ""),
        )

        return {
            "answer": result["answer"],
            "context_mode": context_mode,
            "used_gemini": result["used_gemini"],
            "paper_found": True,
        }

    # Internal: paper metadata lookup
   
    def _get_paper_metadata(self, paper_id: str) -> dict | None:
        """Fetches title/abstract/url/pdf_url for a paper from the paper store."""
        result = self.paper_store.get_by_id(paper_id)

        if result is None:
            logger.warning(f"Chat requested for unknown paper_id: '{paper_id}'")
            return None

        metadata = result["metadatas"][0]
        document = result["documents"][0]

        return {
            "title": metadata.get("title", ""),
            "abstract": metadata.get("abstract") or document,
            "url": metadata.get("url", ""),
            "pdf_url": metadata.get("pdf_url", ""),
        }

    # Internal: lazy PDF -> chunk -> embed pipeline
   
    def _ensure_chunks_ready(self, paper_id: str, pdf_url: str) -> str:
       
        with self._lock:
            already_known_abstract_only = paper_id in self._known_abstract_only

        if already_known_abstract_only:
            return "abstract_only"

        if self.chunk_store.has_chunks(paper_id):
            return "full_text"

        logger.info(f"First chat interaction for paper '{paper_id}' — preparing full-text context.")

        text = self.pdf_fetcher.extract_text(pdf_url)

        if text is None:
            logger.info(f"No usable PDF for paper '{paper_id}'. Falling back to abstract-only chat.")
            with self._lock:
                self._known_abstract_only.add(paper_id)
            return "abstract_only"

        chunks = self.chunker.chunk_text(text, paper_id)
        stored = self.chunk_store.store_chunks(chunks)

        if not stored:
            logger.warning(f"Chunk storage failed for paper '{paper_id}'. Falling back to abstract-only chat.")
            with self._lock:
                self._known_abstract_only.add(paper_id)
            return "abstract_only"

        return "full_text"

   
    # Internal: context retrieval for a question
    
    def _retrieve_context(self, paper_id: str, question: str, context_mode: str, abstract: str) -> list:
        """Returns the text context to answer from, based on the current context_mode."""
        if context_mode == "abstract_only":
            return [abstract] if abstract else []

        embedder = self.chunk_store.embedder
        question_vector = embedder.encode_text(embedder.construct_query_text(question))

        if question_vector is None:
            logger.warning(f"Failed to embed question for paper '{paper_id}'. Falling back to abstract.")
            return [abstract] if abstract else []

        chunks = self.chunk_store.query_chunks(paper_id, question_vector, top_k=TOP_K_CHUNKS)

        if not chunks:
            logger.warning(
                f"No chunks retrieved for paper '{paper_id}' despite full_text mode. "
                f"Falling back to abstract for this question."
            )
            return [abstract] if abstract else []

        return chunks