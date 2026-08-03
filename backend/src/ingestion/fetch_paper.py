import time
import json
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG

# Base Client

class BaseSearchClient:
    """Common helper utilities shared by all academic search clients."""

    @staticmethod
    def normalize_paper(
        paper_id,
        title,
        abstract,
        authors,
        year,
        url,
        source,
        pdf_url=None,
    ):
        """
        Convert raw fields into a standard paper dictionary shape.
.
        """
        return {
            "paper_id": paper_id,
            "title": title,
            "abstract": abstract or "Abstract unavailable.",
            "authors": authors,
            "year": str(year) if year else "Unknown",
            "url": url,
            "pdf_url": pdf_url,
            "source": source,
        }


# Semantic Scholar Client

class SemanticScholarClient(BaseSearchClient):
    """Primary academic search provider using the Semantic Scholar API."""

    def __init__(self):
        ss_config = CONFIG.get("api", {}).get("semantic_scholar", {})
        self.base_url = ss_config.get("base_url", "https://api.semanticscholar.org/graph/v1") + "/paper/search"
        self.timeout = int(CONFIG.get("search", {}).get("network_timeout", 15))
        self.api_key = ss_config.get("api_key", "")

       

        self.fields = (
            "title,abstract,authors,year,url,externalIds,paperId,"
            "openAccessPdf,isOpenAccess"
        )

    def fetch_papers(
        self,
        query: str,
        limit: int = 5,
        offset: int = 0,
        field_of_study: str = None,
    ) -> list:
        
        query = query.strip()
        if not query:
            return []

        logger.info(f"Searching Semantic Scholar : {query}")

        params = {
            "query": query,
            "limit": limit,
            "offset": offset,
            "fields": self.fields,
        }

        if field_of_study:
            params["fieldsOfStudy"] = field_of_study

        request_url = self.base_url + "?" + urllib.parse.urlencode(params)
        
        headers = {"User-Agent": "Research-Mentor-AI"}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        req = urllib.request.Request(
            request_url,
            headers=headers,
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                data = json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                logger.warning("Semantic Scholar rate limit reached.")
            else:
                logger.error(f"Semantic Scholar HTTP Error : {e.code}")
            return []
        except Exception as e:
            logger.error(f"Semantic Scholar failed : {e}")
            return []

        papers = [self._parse_item(item) for item in data.get("data", [])]

        logger.info(f"Semantic Scholar returned {len(papers)} papers.")
        return papers

    def _parse_item(self, item: dict) -> dict:
        """Convert a single raw Semantic Scholar item into a normalized paper."""
        authors = ", ".join(
            author["name"] for author in item.get("authors", []) if author.get("name")
        )
        paper_id = item.get("externalIds", {}).get("ArXiv") or item.get("paperId")

        pdf_info = item.get("openAccessPdf") or {}
        pdf_url = pdf_info.get("url")

        return self.normalize_paper(
            paper_id=paper_id,
            title=item.get("title"),
            abstract=item.get("abstract"),
            authors=authors,
            year=item.get("year"),
            url=item.get("url"),
            source="semantic_scholar",
            pdf_url=pdf_url,
        )


# arXiv Client

class ArxivClient(BaseSearchClient):

    _last_request_time = 0.0

    def __init__(self):
        arxiv_config = CONFIG.get("api", {}).get("arxiv", {})
        self.base_url = arxiv_config.get("base_url", "http://export.arxiv.org/api/query")
        if not self.base_url.endswith("?"):
            self.base_url += "?"

        self.timeout = int(CONFIG.get("search", {}).get("arxiv_timeout", 30))
        self.rate_limit_seconds = float(arxiv_config.get("rate_limit_seconds", 3))
        self.max_retry = 3

    def _enforce_rate_limit(self):
        """Enforces delay between requests to comply with arXiv's policy."""
        elapsed = time.time() - ArxivClient._last_request_time
        if elapsed < self.rate_limit_seconds:
            sleep_duration = self.rate_limit_seconds - elapsed
            logger.info(f"Throttling arXiv request: sleeping for {sleep_duration:.2f} seconds.")
            time.sleep(sleep_duration)
        ArxivClient._last_request_time = time.time()

    def fetch_papers(
        self,
        query: str,
        limit: int = 5,
        offset: int = 0,
        field_of_study: str = None,
    ) -> list:
       
        query = query.strip()
        if not query:
            logger.warning("arXiv search skipped because query is empty.")
            return []

        logger.info(f"Issuing arXiv search request : '{query}'")

        encoded_query = urllib.parse.quote(f"all:{query}")
        request_url = (
            f"{self.base_url}"
            f"search_query={encoded_query}"
            f"&start={offset}"
            f"&max_results={limit}"
            f"&sortBy=relevance"
            f"&sortOrder=descending"
        )
        request = urllib.request.Request(
            request_url,
            headers={"User-Agent": "Research-Mentor-AI"},
        )

        raw_xml = self._request_with_retry(request)
        if raw_xml is None:
            logger.error("arXiv failed after maximum retry attempts.")
            return []

        return self._parse_xml(raw_xml)

    def _request_with_retry(self, request: urllib.request.Request):
        """Attempt the arXiv request up to self.max_retry times, retrying on HTTP errors."""
        for attempt in range(self.max_retry):
            try:
                self._enforce_rate_limit()
                logger.info(f"arXiv request attempt {attempt + 1}")

                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    raw_xml = response.read()

                logger.info("arXiv request completed successfully.")
                return raw_xml

            except urllib.error.HTTPError as e:
                wait_time = (attempt + 1) * self.rate_limit_seconds
                logger.warning(
                    f"arXiv HTTP Error {e.code}. Retrying in {wait_time} seconds..."
                )
                time.sleep(wait_time)

            except urllib.error.URLError as e:
                logger.error(f"arXiv network error : {e.reason}")
                return None

            except Exception as e:
                logger.exception(f"Unexpected arXiv failure : {e}")
                return None

        return None

    def _parse_xml(self, raw_xml: bytes) -> list:
        """Parse arXiv XML response into standardized paper dictionaries."""
        namespace = {"atom": "http://www.w3.org/2005/Atom"}

        try:
            root = ET.fromstring(raw_xml)
        except ET.ParseError as e:
            logger.exception(f"Failed to parse arXiv XML response : {e}")
            return []

        entries = root.findall("atom:entry", namespace)
        logger.info(f"Parsing {len(entries)} arXiv papers.")

        papers = []
        for entry in entries:
            try:
                papers.append(self._parse_entry(entry, namespace))
            except Exception as e:
                logger.exception(f"Failed to parse an arXiv paper : {e}")

        logger.info(f"arXiv returned {len(papers)} papers.")
        return papers

    def _parse_entry(self, entry, namespace: dict) -> dict:
        """Convert a single <atom:entry> XML element into a normalized paper."""
        raw_id = self._text(entry, "atom:id", namespace)
        paper_id = raw_id.split("/abs/")[-1].split("v")[0]

        title = self._text(entry, "atom:title", namespace).replace("\n", " ").strip()
        abstract = self._text(entry, "atom:summary", namespace).replace("\n", " ").strip()
        year = self._text(entry, "atom:published", namespace)[:4]

        link_el = entry.find("atom:link[@rel='alternate']", namespace)
        url = link_el.attrib["href"] if link_el is not None else None

        authors = ", ".join(
            author.find("atom:name", namespace).text
            for author in entry.findall("atom:author", namespace)
            if author.find("atom:name", namespace) is not None
        )

        
        
        pdf_url = f"https://arxiv.org/pdf/{paper_id}" if paper_id else None

        return self.normalize_paper(
            paper_id=paper_id,
            title=title,
            abstract=abstract,
            authors=authors,
            year=year,
            url=url,
            source="arxiv",
            pdf_url=pdf_url,
        )

    @staticmethod
    def _text(entry, tag: str, namespace: dict) -> str:
        """Safely extract text from an XML child element, defaulting to ''."""
        el = entry.find(tag, namespace)
        return el.text if el is not None and el.text is not None else ""