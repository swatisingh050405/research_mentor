import os
import yaml
from pathlib import Path
from dotenv import load_dotenv
from src.common.logger import logger

def get_project_root() -> Path:
    """Safely calculates the absolute root directory of the project."""
    return Path(__file__).resolve().parents[2]

# --- CENTRALIZED PATH MANAGEMENT ---
ROOT_DIR = get_project_root()
DATA_DIR = ROOT_DIR / "data"
LOGS_DIR = ROOT_DIR / "logs"

# Specific operational targets
CHROMA_DB_PATH = DATA_DIR / "chroma_db"
EXTRACTED_PAPERS_JSON = DATA_DIR / "extracted_papers.json"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# Load environment variables from .env if present
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
    logger.info("Environment variables successfully loaded from .env file.")

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

# Ensure the Gemini API key is present in the environment and bridge it to the config

if "api" not in CONFIG:
    CONFIG["api"] = {}
if "gemini" not in CONFIG["api"]:
    CONFIG["api"]["gemini"] = {}
    
# Ensure the Gemini API key is present in the environment
CONFIG["api"]["gemini"]["api_key"] = os.getenv("GEMINI_API_KEY", "")