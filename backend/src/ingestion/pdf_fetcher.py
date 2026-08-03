import urllib.request
import urllib.error

import fitz  # PyMuPDF

from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG


class PDFFetcher:
   

    def __init__(self):
        self.timeout = int(CONFIG.get("rag", {}).get("pdf_fetch_timeout", 20))
        self.max_pages = int(CONFIG.get("rag", {}).get("pdf_max_pages", 60))
        self.max_bytes = int(CONFIG.get("rag", {}).get("pdf_max_bytes", 25 * 1024 * 1024))  # 25MB

    def extract_text(self, pdf_url: str) -> str | None:
        """
        Downloads the PDF at pdf_url and returns its extracted plain text,
        or None if the PDF is unavailable, unreadable, or exceeds size limits.
        """
        if not pdf_url:
            logger.info("No pdf_url provided — skipping PDF extraction.")
            return None

        raw_bytes = self._download(pdf_url)
        if raw_bytes is None:
            return None

        return self._extract_text_from_bytes(raw_bytes, source=pdf_url)

    
    # Download
   
    def _download(self, pdf_url: str) -> bytes | None:
        """Downloads the raw PDF bytes, enforcing a max size to avoid memory blowups."""
        request = urllib.request.Request(
            pdf_url,
            headers={"User-Agent": "Research-Mentor-AI"},
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                content_type = response.headers.get("Content-Type", "")

                if "pdf" not in content_type.lower() and not pdf_url.lower().endswith(".pdf"):
                    logger.warning(
                        f"URL does not look like a PDF (Content-Type: '{content_type}'): {pdf_url}"
                    )
                    

                data = response.read(self.max_bytes + 1)

                if len(data) > self.max_bytes:
                    logger.warning(
                        f"PDF at {pdf_url} exceeds max size "
                        f"({self.max_bytes} bytes). Skipping."
                    )
                    return None

                return data

        except urllib.error.HTTPError as e:
            logger.warning(f"PDF download failed (HTTP {e.code}) for {pdf_url}")
            return None

        except urllib.error.URLError as e:
            logger.warning(f"PDF download network error for {pdf_url}: {e.reason}")
            return None

        except Exception as e:
            logger.warning(f"Unexpected PDF download failure for {pdf_url}: {e}")
            return None

    
    # Text extraction

   
    def _extract_text_from_bytes(self, raw_bytes: bytes, source: str) -> str | None:
        """Parses PDF bytes with PyMuPDF and concatenates text across pages."""
        try:
            document = fitz.open(stream=raw_bytes, filetype="pdf")

        except Exception as e:
            logger.warning(f"PDF could not be parsed (corrupted or not a real PDF) from {source}: {e}")
            return None

        try:
            if document.is_encrypted:
               
                if not document.authenticate(""):
                    logger.warning(f"PDF is encrypted and could not be opened: {source}")
                    document.close()
                    return None

            page_count = document.page_count

            if page_count == 0:
                logger.warning(f"PDF has no pages: {source}")
                document.close()
                return None

            pages_to_read = min(page_count, self.max_pages)

            if page_count > self.max_pages:
                logger.info(
                    f"PDF has {page_count} pages, truncating to first "
                    f"{self.max_pages} for {source}."
                )

            text_parts = []
            for page_index in range(pages_to_read):
                try:
                    page = document.load_page(page_index)
                    text_parts.append(page.get_text())
                except Exception as e:
                    logger.warning(f"Failed to extract page {page_index} from {source}: {e}")
                    continue

            document.close()

            full_text = "\n".join(text_parts).strip()

            if not full_text:
                logger.warning(f"PDF extraction produced no text (likely scanned/image-only): {source}")
                return None

            logger.info(f"Extracted {len(full_text)} characters from {pages_to_read} pages: {source}")
            return full_text

        except Exception as e:
            logger.warning(f"Unexpected error while extracting text from {source}: {e}")
            try:
                document.close()
            except Exception:
                pass
            return None