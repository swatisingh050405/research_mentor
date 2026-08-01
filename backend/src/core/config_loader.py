import os
import yaml
from pathlib import Path
from dotenv import load_dotenv
from backend.src.core.logger import logger


def get_project_root() -> Path:
    """

    Returns:
        Path: The absolute root directory of the project
    """
    return Path(__file__).resolve().parents[3]


# --- CENTRALIZED PATH MANAGEMENT ---
ROOT_DIR = get_project_root()
DATA_DIR = ROOT_DIR / "data"
LOGS_DIR = ROOT_DIR / "logs"

# Specific operational targets
CHROMA_DB_PATH = DATA_DIR / "chroma_db"
EXTRACTED_PAPERS_JSON = DATA_DIR / "extracted_papers.json"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Load environment variables from .env if present
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
    logger.info("Environment variables successfully loaded from .env file.")
else:
    logger.warning(f".env file not found at expected path: {ENV_PATH}")


def load_yaml_config(file_name: str) -> dict:
    """Utility to safely load configuration YAML files."""
    file_path = ROOT_DIR / "config" / file_name
    if not file_path.exists():
        logger.error(f"Config file missing at expected path: {file_path}")
        raise FileNotFoundError(f"Config file missing at: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        try:
            return yaml.safe_load(f)
        except yaml.YAMLError as e:
            logger.error(f"Failed to parse YAML file {file_name}: {e}")
            raise


# Instantiate global settings singletons
CONFIG = load_yaml_config("config.yaml")
PROMPTS = load_yaml_config("prompts.yaml")

# --- API KEY BRIDGING ---
if "api" not in CONFIG:
    CONFIG["api"] = {}

# 1. Gemini API Key
if "gemini" not in CONFIG["api"]:
    CONFIG["api"]["gemini"] = {}

CONFIG["api"]["gemini"]["api_key"] = os.getenv("GEMINI_API_KEY", "")

if not CONFIG["api"]["gemini"]["api_key"]:
    logger.warning(
        "GEMINI_API_KEY not found in environment — Gemini API calls will fail "
        "until this is set in your .env file."
    )

# 2. Semantic Scholar API Key
if "semantic_scholar" not in CONFIG["api"]:
    CONFIG["api"]["semantic_scholar"] = {}

CONFIG["api"]["semantic_scholar"]["api_key"] = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")

if not CONFIG["api"]["semantic_scholar"]["api_key"]:
    logger.info(
        "SEMANTIC_SCHOLAR_API_KEY not found in .env — defaulting to unauthenticated "
        "rate-limited access."
    )