# AI service (workstream C)

A Python FastAPI service with the document reader, the companion chat and the cost estimates.

**It is internal.** Only the backend (`../App.js`) calls it. It holds the paid API key, so it refuses everyone
else: with `AI_SERVICE_TOKEN` set, a caller must send that token in an `X-Internal-Token` header; with no token
set, only callers on the same machine are answered. Browsers never call it, so it sends no CORS headers. See
`../SECURITY.md`.

## Run it

Set up the Python environment and `.env` as the README at the top of the repo describes, then:

```bash
cd ai
../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

http://localhost:8000/health shows whether you're in mock mode.
While developing, start it with `AI_DOCS=1` in front to get FastAPI's test page at http://localhost:8000/docs.
The test page is off otherwise, because it lists every endpoint.

**Mock mode:** with no API key, every endpoint still works but returns fake answers
labeled "MOCK". The web team can build against it right away.

## Files

| File | What it does |
| --- | --- |
| `main.py` | The endpoints: `/extract`, `/estimate`, `/clinics`, `/services`, `/chat`, plus `/health`. Also who may call them, and the size limits |
| `extract.py` | Document reader. Opens only ordinary photo types and PDFs, asks Claude to call a `save_record` tool, then keeps only the expected fields at fixed lengths |
| `companion.py` | Companion agent. The system prompt holds the rules, and the agent loop runs the two read-only tools |
| `records.py` | A simple keyword search over the records the backend sends. Stores nothing |
| `estimate_stub.py` | Cost estimates from the trained model in `model/` (workstream D). The file name is left over from the placeholder |
| `llm.py` | The only file that talks to the LLM API |

## Endpoints (called by the backend)

**POST /extract**: form-data with `file` (a JPEG, PNG, WebP or HEIC photo, or a PDF; 15 MB at most). Nothing is
stored here. The backend gives the record its id and saves it.
```json
{"type": "visit_summary", "date": "2026-11-14", "provider": "...",
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
  "service_code": "87880", "low": 18, "typical": 19, "high": 31, "based_on": "clinic", "caveat": "..."}]
```

**GET /services**: the services and visits the model can price, for menus

**POST /chat**
```json
// in  (the backend sends the signed-in patient's records. Left out, the synthetic sample records for "maya" are used)
{"message": "How much is a strep test?", "patient_id": "maya", "history": [], "records": null}
// out
{"reply": "...", "used_records": ["doc_imm001"], "used_estimates": [ ... ]}
```
`history` is the earlier messages, as `[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`.
Only those two roles are accepted, at most 20 turns. `message` is 2,000 characters at most.

## Demo test questions

- "I think I have strep. How much would it cost to get checked?"
- "My clinical placement needs my immunization record. Do I have my MMR?"
- (after uploading a visit summary) "What does my visit summary mean?"
- "I can't breathe and my chest hurts" (should point to 911 or the ER right away)

## Good to know

- Uploaded documents and chat messages are sent to the Anthropic API to be read and answered.
- `model/cost_model.joblib` is a Python pickle. It is only loaded if it matches the fingerprint in
  `model/cost_model.sha256`, which `model/train.py` writes. Never load a model file from someone you do not trust.
- Sample records in `data/sample_records.json` are synthetic, not real patient data.
