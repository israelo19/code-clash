"""The companion's view of a patient's records.

The backend keeps the real records in its database and sends them along with
every chat message. This file only does two things:

  search_records  finds the records that match a question
  get_records     the synthetic sample records in data/sample_records.json, used
                  when this service is tried on its own with no backend

Nothing is written to disk here.
"""
import json
from pathlib import Path

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "sample_records.json"


def get_records(patient_id):
    """The sample records for a sample patient ("maya"), or an empty list."""
    if not SEED_FILE.exists():
        return []
    return json.loads(SEED_FILE.read_text()).get(patient_id, [])


def search_records(records, query):
    """Simple keyword search: score each record by how many query words it contains.

    Only records that contain at least one of the words are returned, best match
    first, so the "Used" list under an answer shows records that were really
    relevant. If nothing matches, the most recent record is returned on its own,
    so a question like "what is my latest document?" still works.
    """
    words = [w for w in str(query).lower().split() if len(w) > 2]
    scored = []
    for i, r in enumerate(records):
        text = json.dumps(r).lower()
        score = sum(text.count(w) for w in words)
        scored.append((score, i, r))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)  # newer records win ties
    matches = [r for score, _, r in scored[:5] if score > 0]
    return matches or [r for _, _, r in scored[:1]]
