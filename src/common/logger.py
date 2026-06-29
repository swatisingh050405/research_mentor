import logging
import sys
from pathlib import Path

def setup_logger(name: str = "app_logger") -> logging.Logger:
    """Sets up a dual-destination logger tracking to console and a file."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # Avoid duplicating log handlers if already initialized

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(name)s.%(funcName)s:%(lineno)d] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Console Output Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File Output Handler
    log_dir = Path(__file__).resolve().parents[2] / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "app.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# Single reference instance for standard use across our modules
logger = setup_logger()