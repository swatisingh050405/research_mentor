import json
import time
from google import genai
from google.genai import types
from src.common.logger import logger
from src.common.config_loader import CONFIG, PROMPTS


class PaperAnalyzer:
    def __init__(self):
        """Initializes the upgraded next-gen Google Gemini GenAI client wrapper."""
        self.api_key = CONFIG.get("api", {}).get("gemini", {}).get("api_key", "")
        self.model_name = CONFIG.get("api", {}).get("gemini", {}).get("model_name", "gemini-1.5-flash")
        
        if not self.api_key:
            logger.error("Missing Gemini API credential! Check your local secret environment keys.")
            raise ValueError("Gemini API Key validation check failed.")

        # 🌟 NEW SDK SYNTAX: Direct client initialization
        self.client = genai.Client(api_key=self.api_key)
        logger.info(f"Modernized GenAI engine synchronized target: '{self.model_name}'")

    def extract_search(self, user_query: str) -> dict:
        """
        Processes conversational raw input and isolates clean structural parameters
        programmatically aligned for cross-disciplinary academic search client APIs.
        """
        logger.info("Extracting search intent payload tokens through GenAI layer...")
        
        system_instruction = PROMPTS["query_enhancer"]["system_instruction"]

        user_prompt = PROMPTS["query_enhancer"]["user_template"].format(
            query=user_query
        )

        try:
            #  NEW SDK CALL: Enforcing structured JSON extraction schema output
            response = self.client.models.generate_content(
            model=self.model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1
            )
        )
            
            enhanced_query = response.text.strip()
            return {
            "original_query": user_query,
            "search_query": enhanced_query,
            "used_gemini": True
        }
                    
        except Exception as e:
            logger.warning(
        f"Gemini query enhancement unavailable. Falling back to original query. Error: {e}"
    )

        return {
            "original_query": user_query,
            "search_query": user_query,
            "used_gemini": False
        }


    

    def _generate_json_response(
        self,
        system_instruction: str,
        user_prompt: str
    ) -> str:
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
                        temperature=0.2
                    )

                )

                logger.info("Gemini response generated successfully.")

                return response.text.strip()

            except Exception as e:

                if attempt < retry_count - 1:

                    wait = retry_delays[attempt]

                    logger.warning(
                        f"Gemini request failed. Retry {attempt+1}/{retry_count}. Waiting {wait}s. Error: {e}"
                    )

                    time.sleep(wait)

                else:

                    logger.error(
                        "Gemini request failed after all retries."
                    )

                    raise

    def analyze_paper_context(
    self,
    title: str,
    abstract: str
) -> dict:
        """
        Generates summary, keywords and difficulty
        for a single research paper.
        """

        logger.info(
            f"Analyzing paper : {title[:60]}"
        )

        system_instruction = PROMPTS["paper_analyzer"]["system_instruction"]

        user_prompt = PROMPTS["paper_analyzer"]["user_template"].format(
            title=title,
            abstract=abstract
        )

        try:

            raw_text = self._generate_json_response(
                system_instruction,
                user_prompt
            )

            analysis = json.loads(raw_text)

            return {

                "summary": analysis.get(
                    "summary",
                    abstract[:300]
                ),

                "keywords": analysis.get(
                    "keywords",
                    []
                ),

                "difficulty_level": analysis.get(
                    "difficulty_level",
                    "Intermediate"
                )

            }

        except Exception as e:

            logger.warning(
                f"Paper analysis failed. Using abstract fallback. Error: {e}"
            )

            return {

                "summary": abstract,

                "keywords": [],

                "difficulty_level": "Intermediate"

            }

    def analyze_papers_batch(self, papers: list) -> list:
        """
        Generates AI summaries, keywords and difficulty levels
        for multiple research papers in a single Gemini request.
        """

        if not papers:

            logger.warning(
                "Batch paper analyzer received an empty paper list."
            )

            return []

        logger.info(
            f"Starting batch analysis for {len(papers)} papers."
        )

        system_instruction = PROMPTS["paper_batch_analyzer"]["system_instruction"]

        paper_block = ""

        for index, paper in enumerate(papers, start=1):

            paper_block += f"""
    Paper {index}

    Title:
    {paper.get("title", "")}

    Abstract:
    {paper.get("abstract", "")}

    """

        user_prompt = PROMPTS["paper_batch_analyzer"]["user_template"].format(
            papers=paper_block
        )

        try:

            raw_text = self._generate_json_response(
                system_instruction,
                user_prompt
            )

            start = raw_text.find("[")
            end = raw_text.rfind("]")

            if start == -1 or end == -1:

                raise ValueError(
                    "Gemini returned invalid batch JSON."
                )

            analysis = json.loads(
                raw_text[start:end + 1]
            )

            logger.info(
                "Batch paper analysis completed successfully."
            )

            return {
            "used_gemini": True,
            "analysis": analysis
        }

        

        except Exception as e:

            logger.warning(
                f"Batch analysis failed. Falling back to abstract summaries. Error: {e}"
            )

            fallback = []

            for paper in papers:

                fallback.append({

                    "summary": paper.get(
                        "abstract",
                        "Summary unavailable."
                    ),

                    "keywords": [],

                    "difficulty_level": "Intermediate"

                })

            return {
                "used_gemini": False,
                "analysis": fallback
            }