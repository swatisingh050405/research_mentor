from backend.src.core.logger import logger
from backend.src.core.config_loader import CONFIG


class TextChunker:
    

    def __init__(self):
        self.chunk_size = int(CONFIG.get("rag", {}).get("chunk_size_words", 350))
        self.chunk_overlap = int(CONFIG.get("rag", {}).get("chunk_overlap_words", 60))

        if self.chunk_overlap >= self.chunk_size:
            logger.warning(
                f"chunk_overlap_words ({self.chunk_overlap}) >= chunk_size_words "
                f"({self.chunk_size}) — this would prevent forward progress. "
                f"Clamping overlap down."
            )
            self.chunk_overlap = max(0, self.chunk_size // 4)

    def chunk_text(self, text: str, paper_id: str) -> list:
       
        text = (text or "").strip()

        if not text:
            logger.warning(f"chunk_text called with empty text for paper_id={paper_id}")
            return []

        words = text.split()

        if not words:
            return []

        chunks = []
        start = 0
        chunk_index = 0
        step = self.chunk_size - self.chunk_overlap

        while start < len(words):
            end = min(start + self.chunk_size, len(words))
            chunk_words = words[start:end]

            chunks.append({
                "chunk_id": f"{paper_id}_chunk_{chunk_index}",
                "paper_id": paper_id,
                "chunk_index": chunk_index,
                "text": " ".join(chunk_words),
            })

            chunk_index += 1

            if end == len(words):
                break

            start += step

        logger.info(f"Split paper '{paper_id}' into {len(chunks)} chunks.")
        return chunks