from threading import Lock

from backend.src.core.logger import logger
from backend.src.ingestion.pdf_fetcher import PDFFetcher
from backend.src.ml_pipeline.chunker import TextChunker
from backend.src.ml_pipeline.llm_analyzer import PaperAnalyzer
from backend.src.vector_store.chunk_store import ChunkStoreManager
from backend.src.vector_store.paper_store import VectorStoreManager

TOP_K_CHUNKS = 5


class ChatOrchestrator:
    """
    Coordinates the "chat with paper" (RAG) flow:

    1. Lazily ensures a paper's full text is fetched, chunked, and embedded
       (only on first chat interaction for that paper — see prepare_chat).
    2. Retrieves the most relevant chunks for a given question (scoped to
       that one paper).
    3. Asks Gemini to answer, grounded in that retrieved context.

    Falls back gracefully to abstract-only answering when no PDF is
    available or extraction fails, per the "graceful degradation" design —
    chat is never simply disabled, it just answers with reduced confidence
    and says so honestly.
    """

    def __init__(self):
        logger.info("Initializing Chat Orchestrator...")

        self.pdf_fetcher = PDFFetcher()
        self.chunker = TextChunker()
        self.chunk_store = ChunkStoreManager()
        self.llm_analyzer = PaperAnalyzer()
 
        # Reused for paper metadata lookups (title, abstract, pdf_url, url).
        # Chat operates on papers that were already found via search, so
        # they're expected to already exist in this collection.
        self.paper_store = VectorStoreManager()

        # In-process memory of papers whose PDF extraction already failed
        # this server run, so we don't re-attempt a download on every
        # single chat message for the same paper. Not persisted — resets
        # on restart, which is fine (a paper might become available later,
        # e.g. if a dead link gets fixed upstream).

        self._known_abstract_only = set()
        self._lock = Lock()

        logger.info("Chat Orchestrator initialized successfully.")

    # Public API
  
    def prepare_chat(self, paper_id: str) -> dict:
        """
        Ensures this paper is ready for chat: fetches + chunks + embeds
        the PDF if this is the first time chat has been opened for it.
        Safe to call multiple times — it's a no-op if chunks already
        exist or if we already know this paper has no usable PDF.

        Intended to be called when the user opens the chat panel (before
        they've typed a question), so the frontend can show a distinct
        "Preparing this paper for chat..." loading state.

        Returns
        -------
        dict
            {"context_mode": "full_text" | "abstract_only", "paper_found": bool}
        """
        paper = self._get_paper_metadata(paper_id)

        if paper is None:
            return {"context_mode": None, "paper_found": False}

        context_mode = self._ensure_chunks_ready(paper_id, paper.get("pdf_url", ""))
        return {"context_mode": context_mode, "paper_found": True}

    def ask(self, paper_id: str, question: str) -> dict:
        """
        Answers a user's question about a specific paper.

        Returns
        -------
        dict
            {
                "answer": str,
                "context_mode": "full_text" | "abstract_only" | None,
                "used_gemini": bool,
                "paper_found": bool,
            }
        """
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
        """
        Ensures chunks exist for this paper if a usable PDF is available.
        Only does real work the FIRST time this is called for a given
        paper — subsequent calls are cheap existence checks.

        Returns
        -------
        str
            "full_text" if chunks are available to search, "abstract_only"
            if no PDF was available or extraction/storage failed.
        """
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

    # ------------------------------------------------------------------
    # Internal: context retrieval for a question
    # ------------------------------------------------------------------
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