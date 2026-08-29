import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Load environment variables
load_dotenv(BASE_DIR / ".env")

# Settings
DATABASE_PATH = os.getenv("DATABASE_PATH", str(DATA_DIR / "instagram_tracker.db"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "127.0.0.1")
MOCK_MODE_DEFAULT = os.getenv("MOCK_MODE_DEFAULT", "false").lower() in ("true", "1", "yes")
INSTAGRAM_SESSION_USER = os.getenv("INSTAGRAM_SESSION_USER", "")
INSTAGRAM_SESSION_COOKIE = os.getenv("INSTAGRAM_SESSION_COOKIE", "")

