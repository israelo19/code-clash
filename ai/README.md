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
| `main.py` | The endpoints: `/extract`, `/estimate`, `/clinics`, `/services`, `/chat`, plus `/health` and `/records/{patient_id}` |
| `extract.py` | Document reader. Sends the photo to Claude and forces a `save_record` tool call, so the output is always clean JSON |
| `companion.py` | Companion agent. The system prompt holds the rules, and the agent loop runs the two tools |
| `records.py` | Stores records in `../data/sample_records.json` and does a simple keyword search |
| `estimate_stub.py` | Cost estimates from the trained model in `model/` (workstream D). The file name is left over from the placeholder |
| `llm.py` | The only file that talks to the LLM API |

## Endpoints (for the web team)

**POST /extract**: form-data with `file` (JPG/PNG/WEBP/GIF/PDF) and optional `patient_id`
```json
{"id": "doc_ab12cd34", "type": "visit_summary", "date": "2026-11-14", "provider": "...",
 "fields": {"result": "Positive for strep"}, "summary": "..."}
```

**POST /estimate**: real numbers from the trained cost model
```json
// in: one service...
{"service_code": "87880", "setting": "office", "zip_code": "21204"}
// out
{"service_code": "87880", "service": "Rapid strep test", "setting": "office", "zip3": "212",
 "low": 18, "typical": 50, "high": 58, "based_on": "area", "caveat": "..."}

// in: ...or a whole visit. Visits: office, strep, flu, blood_count, vaccine
{"visit": "strep", "zip_code": "21204", "new_patient": true}
// out
{"visit": "Sore throat visit with a rapid strep test", "items": [ ...one per service... ],
 "total": {"low": 187, "typical": 319, "high": 434}, "based_on": "area", "caveat": "..."}
```
- `setting` is `office` or `facility`. `Campus health center`, `Retail clinic` and `Urgent care` are accepted and
  treated as `office`, because the data cannot tell them apart. `Emergency room` returns a 404 with the reason.
- Add `"clinic": "<id>"` to price one clinic from the list below. The answer then says `"based_on": "clinic"`.
- An unknown service code or visit returns a 404.

**GET /clinics?service_code=87880&zip_code=21204&limit=5**: known clinics nearby, cheapest first
```json
[{"clinic": {"id": "...", "address": "600 E Belvedere Ave Ste A", "city": "Baltimore", "zip": "21212", "providers_in_data": 2},
  "service_code": "87880", "low": 15, "typical": 20, "high": 52, "based_on": "clinic", "caveat": "..."}]
```

**GET /services**: the services and visits the model can price, for menus

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
