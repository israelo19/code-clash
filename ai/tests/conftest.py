"""Runs before any test file is loaded.

Tests must never call the paid API. An empty key puts the service in mock mode,
and python-dotenv does not replace a variable that is already set, so a real
key in a local .env file is ignored here.
"""

import os
import sys
from pathlib import Path

os.environ["ANTHROPIC_API_KEY"] = ""
os.environ.pop("AI_SERVICE_TOKEN", None)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
