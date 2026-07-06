import json
import time
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

from src.common.logger import logger
from src.common.config_loader import CONFIG


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
        source
    ):
        return {
            "paper_id": paper_id,
            "title": title,
            "abstract": abstract or "Abstract unavailable.",
            "authors": authors,
            "year": str(year) if year else "Unknown",
            "url": url,
            "source": source
        }



# Semantic Scholar Client
class SemanticScholarClient(BaseSearchClient):

    def __init__(self):
        self.base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        self.timeout = int(
            CONFIG.get("search", {}).get("network_timeout", 15)
        )

    def fetch_papers(
        self,
        query: str,
        limit: int = 5,
        offset: int = 0
    ) -> list:

        query = query.strip()

        if not query:
            return []

        logger.info(f"Searching Semantic Scholar : {query}")

        params = {
            "query": query,
            "limit": limit,
            "offset": offset,
            "fields": "title,abstract,authors,year,url,externalIds,paperId"
        }

        request_url = (
            self.base_url + "?" + urllib.parse.urlencode(params)
        )

        req = urllib.request.Request(
            request_url,
            headers={
                "User-Agent": "Research-Mentor-AI"
            }
        )

        try:

            with urllib.request.urlopen(
                req,
                timeout=self.timeout
            ) as response:

                data = json.loads(response.read().decode())

        except urllib.error.HTTPError as e:

            if e.code == 429:
                logger.warning(
                    "Semantic Scholar rate limit reached."
                )

            else:
                logger.error(
                    f"Semantic Scholar HTTP Error : {e.code}"
                )

            return []

        except Exception as e:

            logger.error(
                f"Semantic Scholar failed : {e}"
            )
            return []

        papers = []

        for item in data.get("data", []):

            authors = ", ".join(
                author["name"]
                for author in item.get("authors", [])
                if author.get("name")
            )

            paper_id = (
                item.get("externalIds", {}).get("ArXiv")
                or item.get("paperId")
            )

            papers.append(

                self.normalize_paper(

                    paper_id=paper_id,

                    title=item.get("title"),

                    abstract=item.get("abstract"),

                    authors=authors,

                    year=item.get("year"),

                    url=item.get("url"),

                    source="semantic_scholar"

                )

            )

        logger.info(
            f"Semantic Scholar returned {len(papers)} papers."
        )

        return papers



# arXiv Client
class ArxivClient(BaseSearchClient):

    def __init__(self):

        self.base_url = "http://export.arxiv.org/api/query?"

        self.timeout = int(
            CONFIG.get("search", {}).get("arxiv_timeout", 30)
        )

    def fetch_papers(
        self,
        query: str,
        limit: int = 5,
        offset: int = 0
    ) -> list:

        query = query.strip()

        if not query:
            return []

        logger.info(f"Searching arXiv : {query}")

        encoded_query = urllib.parse.quote(f"all:{query}")

        url = (
            f"{self.base_url}"
            f"search_query={encoded_query}"
            f"&start={offset}"
            f"&max_results={limit}"
            f"&sortBy=relevance"
            f"&sortOrder=descending"
        )

        req = urllib.request.Request(

            url,

            headers={
                "User-Agent": "Research-Mentor-AI"
            }

        )

        try:

            with urllib.request.urlopen(
                req,
                timeout=self.timeout
            ) as response:

                raw_xml = response.read()

        except Exception as e:

            logger.error(
                f"arXiv failed : {e}"
            )

            return []

        return self._parse_xml(raw_xml)

    def _parse_xml(self, raw_xml):

        namespace = {
            "atom": "http://www.w3.org/2005/Atom"
        }

        root = ET.fromstring(raw_xml)

        papers = []

        for entry in root.findall("atom:entry", namespace):

            raw_id = entry.find("atom:id", namespace).text

            paper_id = raw_id.split("/abs/")[-1].split("v")[0]

            title = (
                entry.find("atom:title", namespace)
                .text.replace("\n", " ")
                .strip()
            )

            abstract = (
                entry.find("atom:summary", namespace)
                .text.replace("\n", " ")
                .strip()
            )

            year = (
                entry.find("atom:published", namespace)
                .text[:4]
            )

            url = entry.find(
                "atom:link[@rel='alternate']",
                namespace
            ).attrib["href"]

            authors = ", ".join(

                author.find("atom:name", namespace).text

                for author in entry.findall(
                    "atom:author",
                    namespace
                )

            )

            papers.append(

                self.normalize_paper(

                    paper_id=paper_id,

                    title=title,

                    abstract=abstract,

                    authors=authors,

                    year=year,

                    url=url,

                    source="arxiv"

                )

            )

        logger.info(
            f"arXiv returned {len(papers)} papers."
        )

        return papers

# arXiv Client


class ArxivClient(BaseSearchClient):
    """
    Fallback academic search provider.

    Invoked only when Semantic Scholar is unavailable or returns
    insufficient results.
    """

    def __init__(self):

        self.base_url = "http://export.arxiv.org/api/query?"

        self.timeout = int(
            CONFIG.get("search", {}).get("arxiv_timeout", 30)
        )

        self.max_retry = 3

    def fetch_papers(
        self,
        query: str,
        limit: int = 5,
        offset: int = 0
    ) -> list:
        """
        Executes arXiv search request.

        Parameters
        ----------
        query : str
            Search query.

        limit : int
            Number of papers required.

        offset : int
            Pagination offset.

        Returns
        -------
        list
            Normalized paper list.
        """

        query = query.strip()

        if not query:

            logger.warning(
                "arXiv search skipped because query is empty."
            )

            return []

        logger.info(
            f"Issuing arXiv search request : '{query}'"
        )

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

            headers={
                "User-Agent": "Research-Mentor-AI"
            }

        )

        raw_xml = None

        for attempt in range(self.max_retry):

            try:

                logger.info(
                    f"arXiv request attempt {attempt + 1}"
                )

                with urllib.request.urlopen(

                    request,

                    timeout=self.timeout

                ) as response:

                    raw_xml = response.read()

                logger.info(
                    "arXiv request completed successfully."
                )

                break

            except urllib.error.HTTPError as e:

                wait_time = (attempt + 1) * 2

                logger.warning(

                    f"arXiv HTTP Error {e.code}. "
                    f"Retrying in {wait_time} seconds..."

                )

                time.sleep(wait_time)

            except urllib.error.URLError as e:

                logger.error(
                    f"arXiv network error : {e.reason}"
                )

                return []

            except Exception as e:

                logger.exception(
                    f"Unexpected arXiv failure : {e}"
                )

                return []

        if raw_xml is None:

            logger.error(
                "arXiv failed after maximum retry attempts."
            )

            return []

        return self._parse_xml(raw_xml)

    def _parse_xml(self, raw_xml: bytes) -> list:
        """
        Parses arXiv XML response into standardized paper dictionaries.
        """

        namespace = {
            "atom": "http://www.w3.org/2005/Atom"
        }

        papers = []

        try:

            root = ET.fromstring(raw_xml)

        except ET.ParseError as e:

            logger.exception(
                f"Failed to parse arXiv XML response : {e}"
            )

            return []

        entries = root.findall("atom:entry", namespace)

        logger.info(
            f"Parsing {len(entries)} arXiv papers."
        )

        for entry in entries:

            try:

                raw_id = entry.find(
                    "atom:id",
                    namespace
                ).text

                paper_id = raw_id.split("/abs/")[-1].split("v")[0]

                title = (

                    entry.find(
                        "atom:title",
                        namespace
                    ).text

                    .replace("\n", " ")

                    .strip()

                )

                abstract = (

                    entry.find(
                        "atom:summary",
                        namespace
                    ).text

                    .replace("\n", " ")

                    .strip()

                )

                year = (

                    entry.find(
                        "atom:published",
                        namespace
                    ).text[:4]

                )

                link = entry.find(

                    "atom:link[@rel='alternate']",

                    namespace

                ).attrib["href"]

                authors = ", ".join(

                    author.find(
                        "atom:name",
                        namespace
                    ).text

                    for author in entry.findall(
                        "atom:author",
                        namespace
                    )

                )

                papers.append(

                    self.normalize_paper(

                        paper_id=paper_id,

                        title=title,

                        abstract=abstract,

                        authors=authors,

                        year=year,

                        url=link,

                        source="arxiv"

                    )

                )

            except Exception as e:

                logger.exception(
                    f"Failed to parse an arXiv paper : {e}"
                )

        logger.info(
            f"arXiv returned {len(papers)} papers."
        )

        return papers