"""A tiny records store: one JSON file on disk.

This is a stand-in so the AI service works on its own today. Once the backend
(workstream B) has a real database, the web app can send the patient's
records with each /chat request instead (see main.py), or this file can be
changed to read from that database.
"""
import json
import uuid
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "sample_records.json"


def _load():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {}


def _save(all_records):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(all_records, indent=2))


def get_records(patient_id):
    return _load().get(patient_id, [])


def add_record(patient_id, record):
    all_records = _load()
    record = {"id": record.get("id") or f"doc_{uuid.uuid4().hex[:8]}", **record}
    all_records.setdefault(patient_id, []).append(record)
    _save(all_records)
    return record


def search_records(records, query):
    """Simple keyword search: score each record by how many query words it contains."""
    words = [w for w in query.lower().split() if len(w) > 2]
    scored = []
    for r in records:
        text = json.dumps(r).lower()
        score = sum(text.count(w) for w in words)
        if score or not words:
            scored.append((score, r))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [r for _, r in scored[:5]]
