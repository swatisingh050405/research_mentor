import time
import json
import requests
import feedparser
from src.common.logger import logger
from src.common.config_loader import CONFIG, EXTRACTED_PAPERS_JSON

class ArxivClient:
    def __init__(self):
        """Initializes the API client parameters using centralized configs."""
        self.base_url = CONFIG["api"]["arxiv"]["base_url"]
        self.rate_limit = CONFIG["api"]["arxiv"]["rate_limit_seconds"]
        self.default_limit = CONFIG["search"]["default_max_results"]

    def fetch_arxiv_papers(self, query: str, max_results: int = None) -> list:
        """
        Fetch papers from arXiv based on a search query topic.
        """
        limit = max_results if max_results is not None else self.default_limit
        logger.info(f"Initiating live arXiv API fetch for query: '{query}' (Limit: {limit})")

        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": limit,
            "sortBy": "submittedDate",
            "sortOrder": "descending"
        }

        try:
            # Enforcing courtesy API call frequency pacing
            logger.debug(f"Polite delay handling. Sleeping for {self.rate_limit}s...")
            time.sleep(self.rate_limit)

            response = requests.get(self.base_url, params=params, timeout=15)
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Network processing breakdown while hitting arXiv for '{query}': {e}")
            return []

        feed = feedparser.parse(response.text)
        if feed.bozo:
            logger.warning(f"Feed parser structural anomaly discovered: {feed.bozo_exception}")

        papers = []
        skipped = 0
        for entry in feed.entries:
            try:
                published = entry.get("published", entry.get("updated", ""))
                year = int(published[:4]) if published else 0

                # Formulating standard dictionary schema output mapping
                paper = {
                    "id": entry.get("id", "").split("/abs/")[-1], # Clean unique string identifier
                    "title": entry.get("title", "").replace("\n", " ").strip(),
                    "abstract": entry.get("summary", "").replace("\n", " ").strip(),
                    "year": year,
                    "authors": [author.name for author in entry.get("authors", [])],
                    "link": entry.get("link", ""),
                    "query_topic": query
                }

                if not paper["id"] or not paper["title"]:
                    skipped += 1
                    continue

                papers.append(paper)
            except Exception as e:
                logger.warning(f"Skipping malformed feed dictionary entity compilation: {e}")
                skipped += 1
                continue

        if skipped:
            logger.warning(f"Omitted {skipped} imperfect entries inside query retrieval block for '{query}'")

        return papers

# Multi-topic offline loop setup execution script block
if __name__ == "__main__":
    client = ArxivClient()
    topics = [
        "large language models",
        "computer vision architectures",
        "transformers attention mechanism",
        "vector databases search",
        
        # Security & Cryptography Domain
        "cybersecurity network defense",
        "blockchain smart contracts",
        
        # Advanced Computing & Systems Domain
        "quantum computing algorithms",
        "edge computing networks",
        "robotics autonomous navigation",
        
        # Bioinformatics Domain
        "bioinformatics genomic sequencing"
    ]
    all_papers = []
    seen_ids = set()

    for topic in topics:
        papers = client.fetch_arxiv_papers(topic, max_results=30)
        new_count = 0
        for p in papers:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                all_papers.append(p)
                new_count += 1
        logger.info(f"Retrieved {len(papers)} items. Unique newly added: {new_count} for '{topic}'")
    
    logger.info(f"Completed collection parsing pipeline. Total unique unique items: {len(all_papers)}")

    # --- SAVE TO EXTRACTED_PAPERS STORAGE TRACK ---
    try:
        with open(EXTRACTED_PAPERS_JSON, "w", encoding="utf-8") as f:
            json.dump(all_papers, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully saved structured offline data at: {EXTRACTED_PAPERS_JSON}")
    except IOError as e:
        logger.error(f"Failed to write local database offline file mapping: {e}")