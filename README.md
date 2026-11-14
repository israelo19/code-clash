# CareVault

A health companion for students and young adults: keep your records in one place, see what a visit will likely
cost before you go, and ask a companion about your own paperwork. Built at CODE/CLASH 2026.

## The three parts

| Part | Folder | Port | What it does |
| --- | --- | --- | --- |
| Web app | `web/` | 3000 | The screens (Next.js) |
| Backend | `App.js`, `server/` | 4000 | Records, share codes, access log and notes, in a SQLite database |
| AI service | `ai/` | 8000 | Companion chat, document reader, and the trained cost model |

## Run everything

You need Node 22.5 or newer and Python 3.

**Once:** install the Python libraries and put your API key in a file named `.env` at the top of the repo.

```bash
python3 -m venv .venv
.venv/bin/pip install -r ai/requirements.txt
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

Without a key the AI service still runs, in mock mode with fake companion answers.

**Every time:** three terminals, each starting at the top of the repo.

```bash
# Terminal 1: AI service
cd ai
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

```bash
# Terminal 2: backend
npm start
```

```bash
# Terminal 3: web app
cd web
npm install
npm run dev
```

Open http://localhost:3000. On a phone on the same Wi-Fi, open `http://<your-laptop-ip>:3000`.

## Check that it works

- http://localhost:8000/health shows `"mock_mode": false` when the API key was found.
- http://localhost:4000/api/health shows `{"ok":true}`.
- Tests, from the top of the repo:

```bash
.venv/bin/python -m pytest ai/tests    # the cost model
npm test                               # the database and the backend routes
```

## Demo

Sign in as the patient (the details are filled in), then try Costs, Companion, Upload
(`data/demo/sample_visit_summary.png`) and Share. Sign in as the clinician in another tab or on another device
and enter the share code. "Reset demo data" at the bottom of the landing page puts everything back.

## More

- `docs/PROJECT_BRIEF.md`: what we set out to build.
- `docs/DECISIONS.md`: how the cost model was built and tested, the data it uses, and the tools used (including AI tools).
- `docs/brand/LOGO_PROFILE.md`: the logo.
- `web/README.md` and `ai/README.md`: details for each part.
