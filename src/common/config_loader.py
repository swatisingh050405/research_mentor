# src/common/config_loader.py
import yaml
from pathlib import Path
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

# Ensure crucial runtime directories exist right away
DATA_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)


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