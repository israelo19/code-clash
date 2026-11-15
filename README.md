# CareVault

A health companion for students and young adults: keep your records in one place, see what a visit will likely
cost before you go, and ask a companion about your own paperwork. Built at CODE/CLASH 2026.

> **This is a demo.** Every record in it is synthetic. It is **not HIPAA compliant** and must not be used
> with real health information. See [SECURITY.md](SECURITY.md) for what is protected and what is not.

## The three parts

| Part | Folder | Port | What it does |
| --- | --- | --- | --- |
| Web app | `web/` | 3000 | The screens (Next.js). The only part your browser talks to |
| Backend | `App.js`, `server/` | 4000 | Sign-in, records, share codes, access log and notes, in a SQLite database |
| AI service | `ai/` | 8000 | Companion chat, document reader, and the trained cost model |

The browser talks to the web app. The web app passes `/api` requests to the backend. Only the backend talks to
the AI service. The backend and the AI service listen on this machine only.

## Run everything

You need Node 22.13 or newer and Python 3.

**Once:** install the libraries and make your `.env` file.

```bash
npm install                                      # backend
(cd web && npm install)                          # web app
python3 -m venv .venv
.venv/bin/pip install -r ai/requirements.txt     # AI service and cost model
cp .env.example .env                             # then put your API key in .env
```

Without a key the AI service still runs, in mock mode with fake companion answers.
Never commit `.env`. It is in `.gitignore`.

**Every time:** three terminals, each starting at the top of the repo.

```bash
# Terminal 1: AI service
cd ai
../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: backend
npm start
```

```bash
# Terminal 3: web app
cd web
npm run dev
```

Open http://localhost:3000.

To try it on a phone on the same Wi-Fi, run the web app in production mode (`npm run build`, then
`npm start -- --hostname 0.0.0.0` in `web/`) and open `http://<your-laptop-ip>:3000`. Development mode only accepts
requests from the laptop itself.

## Check that it works

- http://localhost:8000/health shows `"mock_mode": false` when the API key was found.
- http://localhost:4000/api/health shows `{"ok":true}`.
- Tests, from the top of the repo:

```bash
npm test                               # backend: sign-in, permissions, sharing, limits
.venv/bin/python -m pytest ai/tests    # cost model, and the AI service's protections
(cd web && npx tsc --noEmit && npm run lint)
```

## Demo

Sign in as the patient (the details are filled in), then try Costs, Companion, Upload
(`data/demo/sample_visit_summary.png`) and Share. Sign in as the clinician in a private window or on another
device and enter the share code. "Reset demo data" at the bottom of the landing page puts everything back.

The two demo accounts, their public password, the `DEMO01` share code and the reset button only exist in
**demo mode**. Demo mode is on when you run locally and off when `NODE_ENV=production`.

## Settings

All optional. Put them in `.env` (the AI service reads it) or in the environment of the process.

| Setting | Used by | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI service | The paid API key. Empty means mock mode |
| `AI_SERVICE_TOKEN` | backend, AI service | A long random secret both share. Set it whenever the two are not on the same machine |
| `AI_URL` | backend | Where the AI service is. Default `http://127.0.0.1:8000` |
| `BACKEND_URL` | web app | Where the backend is. Default `http://127.0.0.1:4000` |
| `NODE_ENV=production` | backend, web app | Turns off demo mode and sends the session cookie over HTTPS only |
| `DEMO_MODE=1` | backend | Forces demo mode on. Do not use on a public server |
| `HOST`, `PORT` | backend | Where the backend listens. Default `127.0.0.1:4000` |

## Security

[SECURITY.md](SECURITY.md) explains how sign-in, permissions, uploads and the AI service are protected, the
known limits, what to set before putting this on the internet, and how to report a problem.

## What we used

The project was written during CODE/CLASH 2026 on November 14, 2026, and hardened afterwards. What we did not write ourselves:

- **Dataset:** CMS, "Medicare Physician & Other Practitioners by Provider and Service", 2024, filtered to Maryland. It trains the cost model. It is public U.S. government data about clinicians' practice locations and charges. https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
- **Demo records:** synthetic, made for the demo (`data/sample_records.json`, `data/demo/`). No real patient data.
- **APIs:** Anthropic Claude API (companion chat and document reader), CMS open data API (the data pull).
- **Web app libraries:** Next.js, React, Tailwind CSS, TypeScript, ESLint.
- **Backend libraries:** Express, cors, node-device-detector. The database is SQLite, built into Node.
- **AI service libraries:** FastAPI, Uvicorn, the Anthropic Python SDK, python-dotenv, python-multipart, Pillow, pillow-heif.
- **Cost model libraries:** scikit-learn, pandas, joblib, requests, matplotlib, pytest.
- **AI tools:** Claude Code helped write and debug code across the project (the cost model, the database layer, connecting the services and the security review) and helped research sources for the video and slides. Every teammate can explain the code in their part.

## License

No license has been chosen yet, which means all rights are reserved by the authors. Until a `LICENSE` file is
added, you may read the code but have no permission to reuse it.

## More

- `SECURITY.md`: how the app is protected, and how to report a problem.
- `CONTRIBUTING.md`: how to propose a change.
- `docs/DECISIONS.md`: how the cost model was built and tested, the data it uses, and the tools used (including AI tools).
- `docs/VIDEO_SCRIPT.md`: the demo video script, with every source we cite.
- `docs/DEVPOST.md`: the text for our Devpost page.
- `docs/PROJECT_BRIEF.md`: the plan we started the hackathon with. Some of it was not built.
- `docs/brand/LOGO_PROFILE.md`: the logo.
- `web/README.md` and `ai/README.md`: details for each part.
