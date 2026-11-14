# AI service (workstream C)

A Python FastAPI service with the document reader and the companion chat.
The web app calls it over HTTP.

## Run it

```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then paste your API key into .env (or leave empty for mock mode)
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000/docs to try every endpoint in the browser.
http://localhost:8000/health shows whether you're in mock mode.

**Mock mode:** with no API key, every endpoint still works but returns fake answers
labeled "MOCK". The web team can build against it right away.

## Files

| File | What it does |
| --- | --- |
| `main.py` | The endpoints: `/extract`, `/estimate`, `/chat`, plus `/health` and `/records/{patient_id}` |
| `extract.py` | Document reader. Sends the photo to Claude and forces a `save_record` tool call, so the output is always clean JSON |
| `companion.py` | Companion agent. The system prompt holds the rules, and the agent loop runs the two tools |
| `records.py` | Stores records in `../data/sample_records.json` and does a simple keyword search |
| `estimate_stub.py` | Placeholder prices. **Workstream D replaces the inside of `estimate()` with the trained model** |
| `llm.py` | The only file that talks to the LLM API |

## Endpoints (for the web team)

**POST /extract**: form-data with `file` (JPG/PNG/WEBP/GIF/PDF) and optional `patient_id`
```json
{"id": "doc_ab12cd34", "type": "visit_summary", "date": "2026-11-14", "provider": "...",
 "fields": {"result": "Positive for strep"}, "summary": "..."}
```

**POST /estimate**
```json
// in
{"service_code": "87880", "setting": "office", "zip_code": "21252"}
// out
{"service_code": "87880", "service": "Rapid strep test", "low": 21, "typical": 35, "high": 63, "caveat": "..."}
```

**POST /chat**
```json
// in  (records is optional: send them if the backend keeps them in its own database)
{"message": "How much is a strep test?", "patient_id": "maya", "history": [], "records": null}
// out
{"reply": "...", "used_records": ["doc_imm001"], "used_estimates": [ ... ]}
```
`history` is the earlier messages, as `[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`.

## Demo test questions

- "I think I have strep. How much would it cost to get checked?"
- "My clinical placement needs my immunization record. Do I have my MMR?"
- (after uploading a visit summary) "What does my visit summary mean?"
- "I can't breathe and my chest hurts" (should point to 911 or the ER right away)

## Disclosures for the main README

- Anthropic Claude API (document reading and companion chat)
- FastAPI, Uvicorn, python-dotenv, python-multipart
- Sample records in `data/sample_records.json` are synthetic, not real patient data
