import time
import uuid
from threading import Lock

from cachetools import TTLCache

from backend.src.core.logger import logger


class SearchSessionStore:
    """
    Short-lived, in-memory store for ranked search result pools.

    Each search creates ONE pool (a ranked list of paper dicts, built once
    from cache + external sources). Subsequent "load more" requests page
    through that SAME pool via its search_id, instead of re-running
    search/ranking logic — this keeps pagination order stable and avoids
    wasting LLM summary calls on papers the user never scrolls to.

    """

    def __init__(self, maxsize: int = 500, ttl_seconds: int = 1800):
        """
        Parameters
        ----------
        maxsize : int
            Max number of concurrent search sessions held in memory.
        ttl_seconds : int
            How long a session stays alive with no activity before it's
            automatically discarded (default 30 minutes).
        """
        self._cache = TTLCache(maxsize=maxsize, ttl=ttl_seconds)
        self._lock = Lock()
        logger.info(
            f"SearchSessionStore initialized (ttl={ttl_seconds}s, maxsize={maxsize})."
        )

    def create(self, pool: list, query_meta: dict) -> str:
        """Stores a new pool and returns its search_id."""
        search_id = str(uuid.uuid4())

        with self._lock:
            self._cache[search_id] = {
                "pool": pool,
                "query_meta": query_meta,
                "created_at": time.time(),
            }

        logger.info(f"Created search session '{search_id}' with pool size {len(pool)}.")
        return search_id

    def get_pool(self, search_id: str):
        """
        Returns the live pool list (mutable reference — callers may update
        entries in place, e.g. to attach freshly generated summaries) or
        None if the search_id is unknown/expired.
        """
        with self._lock:
            session = self._cache.get(search_id)

        if session is None:
            logger.warning(f"Search session '{search_id}' not found or expired.")
            return None

        return session["pool"]

    def get_query_meta(self, search_id: str):
        """Returns the original query metadata (topic, description, queries) for a session."""
        with self._lock:
            session = self._cache.get(search_id)

        return session["query_meta"] if session else None

    def exists(self, search_id: str) -> bool:
        with self._lock:
            return search_id in self._cache