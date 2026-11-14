"""A tiny records store: JSON files on disk.

data/sample_records.json  = the starting records (seed). Never changed by the app.
data/records_store.json   = the working copy that uploads are added to (not committed to git).
POST /reset puts the working copy back to the seed, which is handy before a demo run.

This is a stand-in so the AI service works on its own today. Once the backend
(workstream B) has a real database, the web app can send the patient's
records with each /chat request instead (see main.py).
"""
import json
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SEED_FILE = DATA_DIR / "sample_records.json"
STORE_FILE = DATA_DIR / "records_store.json"


def _load():
    for f in (STORE_FILE, SEED_FILE):
        if f.exists():
            return json.loads(f.read_text())
    return {}


def _save(all_records):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_FILE.write_text(json.dumps(all_records, indent=2))


def reset():
    """Throw away uploads and go back to the starting records."""
    seed = json.loads(SEED_FILE.read_text()) if SEED_FILE.exists() else {}
    _save(seed)
    return {p: len(r) for p, r in seed.items()}


def get_records(patient_id):
    return _load().get(patient_id, [])


def add_record(patient_id, record):
    all_records = _load()
    record = {"id": record.get("id") or f"doc_{uuid.uuid4().hex[:8]}", **record}
    all_records.setdefault(patient_id, []).append(record)
    _save(all_records)
    return record


def search_records(records, query):
    """Simple keyword search: score each record by how many query words it contains.
    Newer records win ties, so "my latest document" finds the most recent upload."""
    words = [w for w in query.lower().split() if len(w) > 2]
    scored = []
    for i, r in enumerate(records):
        text = json.dumps(r).lower()
        score = sum(text.count(w) for w in words)
        scored.append((score, i, r))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [r for _, _, r in scored[:5]]
