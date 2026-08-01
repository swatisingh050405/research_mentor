import json
import time
from google import genai
from google.genai import types
from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG, PROMPTS


# Must exactly match the category list given to Gemini in the
# query_enhancer prompt (prompts.yaml), which itself mirrors Semantic
# Scholar's allowed fieldsOfStudy values. Kept here as the authoritative
# code-side source of truth — Gemini's output is validated against this
# set before it's trusted anywhere downstream.
ALLOWED_FIELDS_OF_STUDY = {
    "Computer Science", "Medicine", "Chemistry", "Biology",
    "Materials Science", "Physics", "Geology", "Psychology", "Art",
    "History", "Geography", "Sociology", "Business", "Political Science",
    "Economics", "Philosophy", "Mathematics", "Engineering",
    "Environmental Science", "Agricultural and Food Sciences",
    "Education", "Law", "Linguistics",
}


class PaperAnalyzer:
    def __init__(self):
        """Initializes the Gemini GenAI client wrapper."""
        self.api_key = CONFIG.get("api", {}).get("gemini", {}).get("api_key", "")
        self.model_name = CONFIG.get("api", {}).get("gemini", {}).get(
            "model_name", "gemini-2.5-flash"
        )

        if not self.api_key:
            logger.error("Missing Gemini API credential! Check your .env file.")
            raise ValueError("Gemini API Key validation check failed.")

        self.client = genai.Client(api_key=self.api_key)
        logger.info(f"Gemini GenAI engine initialized with model: '{self.model_name}'")

    # Query enhancement
   
    def extract_search(self, topic: str, description: str = "") -> dict:
        """
        Turns a user's topic + optional description into search-ready
        queries via Gemini.

        Parameters
        ----------
        topic : str
            The core subject the user wants to search for.
        description : str, optional
            Additional context: intent, constraints, or attributes the
            user cares about. May be empty.

        Returns
        -------
        dict
            {
                "topic": str,
                "description": str,
                "semantic_query": str,   # rich text for VDB embedding search
                "keyword_query": str,    # concise phrase for external APIs
                "field_of_study": str or None,  # validated category, or None
                "used_gemini": bool
            }
        """
        topic = topic.strip()
        description = (description or "").strip()

        logger.info("Extracting search intent via Gemini query enhancer...")

        fallback_query = f"{topic} {description}".strip()

        if not topic:
            logger.warning("extract_search called with an empty topic.")
            return {
                "topic": topic,
                "description": description,
                "semantic_query": fallback_query,
                "keyword_query": fallback_query,
                "field_of_study": None,
                "used_gemini": False,
            }

        system_instruction = PROMPTS["query_enhancer"]["system_instruction"]
        user_prompt = PROMPTS["query_enhancer"]["user_template"].format(
            topic=topic,
            description=description,
        )

        try:
            raw_text = self._generate_json_response(system_instruction, user_prompt)
            parsed = json.loads(raw_text)

            semantic_query = parsed.get("semantic_query") or fallback_query
            keyword_query = parsed.get("keyword_query") or fallback_query
            field_of_study = parsed.get("field_of_study")

            # Defense in depth: never trust the LLM's category choice blindly.
            # If it doesn't exactly match our allowed list, drop it — search
            # simply proceeds without that filter instead of breaking.
            if field_of_study not in ALLOWED_FIELDS_OF_STUDY:
                if field_of_study is not None:
                    logger.warning(
                        f"Gemini returned an unrecognized field_of_study "
                        f"'{field_of_study}'. Ignoring it."
                    )
                field_of_study = None

            return {
                "topic": topic,
                "description": description,
                "semantic_query": semantic_query,
                "keyword_query": keyword_query,
                "field_of_study": field_of_study,
                "used_gemini": True,
            }

        except Exception as e:
            logger.warning(
                f"Gemini query enhancement unavailable. Falling back to raw "
                f"topic/description. Error: {e}"
            )
            return {
                "topic": topic,
                "description": description,
                "semantic_query": fallback_query,
                "keyword_query": fallback_query,
                "field_of_study": None,
                "used_gemini": False,
            }

    # RAG chat — answer a question about one specific paper
   
    def answer_paper_question(
        self,
        question: str,
        context_chunks: list,
        context_mode: str,
        paper_title: str = "",
        paper_url: str = "",
    ) -> dict:
        """
        Answers a user's question about a specific paper, grounded only in
        the given context.

        Parameters
        ----------
        question : str
            The user's chat message.
        context_chunks : list[str]
            Retrieved text — either top-k full-text chunks (context_mode=
            "full_text") or a single-item list containing the abstract
            (context_mode="abstract_only").
        context_mode : str
            "full_text" or "abstract_only" — controls how confidently
            Gemini is allowed to answer (see paper_chat prompt).
        paper_title : str, optional
            Used only to give Gemini orientation, not for retrieval.
        paper_url : str, optional
            Included in the fallback message if generation fails, so the
            user has somewhere to go even when the assistant can't answer.

        Returns
        -------
        dict
            {"answer": str, "used_gemini": bool}
        """
        question = (question or "").strip()

        if not question:
            return {"answer": "Please ask a question about this paper.", "used_gemini": False}

        context = "\n\n---\n\n".join(c for c in context_chunks if c) if context_chunks else ""

        if not context:
            fallback = "I don't have any content available to answer questions about this paper yet."
            if paper_url:
                fallback += f" You can view it directly here: {paper_url}"
            return {"answer": fallback, "used_gemini": False}

        system_instruction = PROMPTS["paper_chat"]["system_instruction"]
        user_prompt = PROMPTS["paper_chat"]["user_template"].format(
            context_mode=context_mode,
            paper_title=paper_title or "Unknown",
            context=context,
            question=question,
        )

        try:
            answer = self._generate_text_response(system_instruction, user_prompt)
            return {"answer": answer.strip(), "used_gemini": True}

        except Exception as e:
            logger.warning(f"Paper chat answer generation failed: {e}")

            fallback = "Sorry, I'm having trouble answering right now. Please try again in a moment."
            if paper_url:
                fallback += f" In the meantime, you can view the paper here: {paper_url}"

            return {"answer": fallback, "used_gemini": False}

    def _generate_text_response(self, system_instruction: str, user_prompt: str) -> str:
        """
        Internal helper for plain-text (non-JSON) Gemini calls, used for
        interactive chat. Uses fewer retries with shorter backoff than
        _generate_json_response, since this runs while a user is actively
        waiting for a reply — a 30+ second retry chain would feel broken
        in a chat UI, whereas it's acceptable for background batch analysis.
        """

        retry_count = 3
        retry_delays = [1, 2, 4]

        for attempt in range(retry_count):

            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                    ),
                )

                logger.info("Gemini chat response generated successfully.")
                return response.text.strip()

            except Exception as e:
                if attempt < retry_count - 1:
                    wait = retry_delays[attempt]
                    logger.warning(
                        f"Gemini chat request failed. Retry {attempt + 1}/{retry_count}. "
                        f"Waiting {wait}s. Error: {e}"
                    )
                    time.sleep(wait)
                else:
                    logger.error("Gemini chat request failed after all retries.")
                    raise

    # Internal helper 
    def _generate_json_response(self, system_instruction: str, user_prompt: str) -> str:
        """
        Internal helper responsible for communicating with Gemini.

        Handles retry logic and returns the raw JSON string.
        """

        retry_count = 5
        retry_delays = [1, 2, 4, 8, 16]

        for attempt in range(retry_count):

            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )

                logger.info("Gemini response generated successfully.")
                return response.text.strip()

            except Exception as e:
                if attempt < retry_count - 1:
                    wait = retry_delays[attempt]
                    logger.warning(
                        f"Gemini request failed. Retry {attempt + 1}/{retry_count}. "
                        f"Waiting {wait}s. Error: {e}"
                    )
                    time.sleep(wait)
                else:
                    logger.error("Gemini request failed after all retries.")
                    raise

    # Single paper analysis
    
    def analyze_paper_context(self, title: str, abstract: str) -> dict:
        """Generates summary, keywords and difficulty for a single research paper."""

        logger.info(f"Analyzing paper : {title[:60]}")

        system_instruction = PROMPTS["paper_analyzer"]["system_instruction"]
        user_prompt = PROMPTS["paper_analyzer"]["user_template"].format(
            title=title,
            abstract=abstract,
        )

        try:
            raw_text = self._generate_json_response(system_instruction, user_prompt)
            analysis = json.loads(raw_text)

            return {
                "summary": analysis.get("summary", abstract[:300]),
                "keywords": analysis.get("keywords", []),
                "difficulty_level": analysis.get("difficulty_level", "Intermediate"),
            }

        except Exception as e:
            logger.warning(f"Paper analysis failed. Using abstract fallback. Error: {e}")
            return {
                "summary": abstract,
                "keywords": [],
                "difficulty_level": "Intermediate",
            }

    
    # Batch paper analysis
  
    def analyze_papers_batch(self, papers: list) -> dict:
        """
        Generates AI summaries, keywords and difficulty levels for multiple
        research papers in a single Gemini request.

        Returns
        -------
        dict
            {"used_gemini": bool, "analysis": list[dict]}
            `analysis` is always the same length as `papers`, in the same
            order, so callers can safely zip() the two together.
        """

        if not papers:
            logger.warning("Batch paper analyzer received an empty paper list.")
            return {"used_gemini": False, "analysis": []}

        logger.info(f"Starting batch analysis for {len(papers)} papers.")

        system_instruction = PROMPTS["paper_batch_analyzer"]["system_instruction"]

        paper_block = ""
        for index, paper in enumerate(papers, start=1):
            paper_block += (
                f"\n    Paper {index}\n\n"
                f"    Title:\n    {paper.get('title', '')}\n\n"
                f"    Abstract:\n    {paper.get('abstract', '')}\n\n"
            )

        user_prompt = PROMPTS["paper_batch_analyzer"]["user_template"].format(
            papers=paper_block
        )

        fallback_analysis = [
            {
                "summary": paper.get("abstract", "Summary unavailable."),
                "keywords": [],
                "difficulty_level": "Intermediate",
            }
            for paper in papers
        ]

        try:
            raw_text = self._generate_json_response(system_instruction, user_prompt)

            start = raw_text.find("[")
            end = raw_text.rfind("]")

            if start == -1 or end == -1:
                raise ValueError("Gemini returned invalid batch JSON.")

            analysis = json.loads(raw_text[start:end + 1])

            # Guard against Gemini returning a different number of entries
            # than papers sent — a silent length mismatch is what causes
            # wrong pairing when zip()'d downstream. Pad/truncate to match.
            if len(analysis) != len(papers):
                logger.warning(
                    f"Gemini returned {len(analysis)} analyses for "
                    f"{len(papers)} papers. Reconciling lengths."
                )
                if len(analysis) < len(papers):
                    analysis.extend(fallback_analysis[len(analysis):])
                else:
                    analysis = analysis[:len(papers)]

            logger.info("Batch paper analysis completed successfully.")
            return {"used_gemini": True, "analysis": analysis}

        except Exception as e:
            logger.warning(f"Batch analysis failed. Falling back to abstract summaries. Error: {e}")
            return {"used_gemini": False, "analysis": fallback_analysis}