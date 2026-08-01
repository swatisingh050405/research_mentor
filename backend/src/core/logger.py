import sys
import os
import logging
from pathlib import Path

# Base logs directory
LOGS_DIR = Path(__file__).resolve().parents[3] / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

class ProductionFormatter(logging.Formatter):
    """Formats logs with ISO timestamp and structured context for log aggregators."""
    def format(self, record):
        log_obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage()
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return str(log_obj)

def setup_logger():
    logger = logging.getLogger("ResearchMentorAI")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    if ENVIRONMENT == "production":
        console_handler.setFormatter(ProductionFormatter(datefmt="%Y-%m-%dT%H:%M:%SZ"))
    else:
        dev_formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(module)s:%(lineno)d] - %(message)s"
        )
        console_handler.setFormatter(dev_formatter)

    logger.addHandler(console_handler)

    # File Handler
    file_handler = logging.FileHandler(LOGS_DIR / "app.log", encoding="utf-8")
    file_handler.setFormatter(logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(module)s:%(lineno)d] - %(message)s"
    ))
    logger.addHandler(file_handler)

    return logger

logger = setup_logger()