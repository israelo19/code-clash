# Web app (Workstream A)

Next.js + TypeScript + Tailwind. Responsive: bottom tabs on phones, sidebar on laptops.
The browser only ever talks to this web app. Requests to `/api/...` are passed on to the backend (`../App.js`, port
4000) by the web server, using the rewrite in `next.config.ts`. The backend keeps the data, checks who is signed in,
and is the only thing that talks to the AI service (`../ai`, port 8000).

## Run it

Three terminals. The full steps are in the README at the top of the repo.

```bash
# 1. AI service, port 8000
cd ai
../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000

# 2. Backend, port 4000 (from the repo root)
npm start

# 3. Web app, port 3000
cd web
npm install
npm run dev
```

If the backend runs somewhere else, set `BACKEND_URL` before `npm run dev` or `npm run build`. It is read on the
server and never sent to the browser.

## Deploy

The web app alone is not the whole product: it needs the backend, and the backend needs the AI service. Read
"Before you put it on the internet" in `../SECURITY.md` first.

For the web app itself (on Vercel, for example): import the repo, set **Root Directory** to `web`, and set
`BACKEND_URL` to the HTTPS address of your backend.

## Security headers

`next.config.ts` sends a Content Security Policy and the other security headers on every page, and turns off the
header that says which framework this is. If you add a script, font or image from another site, the policy will
block it until you allow that site there. Prefer not to.

## Where things are

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Landing page with a live cost preview card. Its sign-in buttons link to the sign-in pages |
| `app/signin/page.tsx` | Patient sign-in page |
| `app/signin/clinician/page.tsx` | Clinician sign-in page |
| `components/SignInForm.tsx` | The sign-in form both of those pages use |
| `app/patient/page.tsx` | Patient dashboard and records timeline |
| `app/patient/upload/` | Photo or file upload, then the parsed record |
| `app/patient/records/[id]/` | One record with its plain-language summary |
| `app/patient/cost/` | Cost estimate for the area, plus known clinics nearby, cheapest first |
| `app/patient/chat/` | Companion chat with the "not a doctor" line |
| `app/patient/share/` | Create expiring share codes and view the access log |
| `app/clinician/` | Enter a share code |
| `app/clinician/view/[code]/` | Shared records and adding a visit note |
| `components/AppShell.tsx` | Navigation. Asks the backend who is signed in before showing a screen |
| `components/ui.tsx` | Cards, timeline item, cost range card, chat bubble |
| `lib/types.ts` | Data shapes. Agree on these with B, C and D |
| `lib/api.ts` | Every call to the backend. Screens never call `fetch` themselves |
| `lib/session.ts` | Who is signed in, as the backend last told us. Nothing secret is kept in the browser |
| `lib/mockData.ts` | The demo accounts' public sign-in details, and the service list |
| `next.config.ts` | The `/api` rewrite to the backend, and the security headers |
| `lib/config.ts` | App name, companion name, disclaimer text |

## Demo notes

- Records, share codes, notes and the access log are in the backend's database, so a patient on a phone and a clinician on a laptop see the same data. Use "Reset demo data" at the bottom of the landing page before presenting.
- Sign-in is checked by the backend. In demo mode it has two demo accounts, and the sign-in pages fill in their email and password for you (`DEMO_LOGINS` in `lib/mockData.ts`). That password is public, so demo mode is for local use only.
- The patient and the clinician cannot both be signed in in one browser, because there is one session cookie. Use a private window or a second device for the clinician.
- In demo mode, code `DEMO01` always opens Maya's immunization record and physical form.
- A photo to upload is in `../data/demo/sample_visit_summary.png`.
- With no API key the AI service runs in mock mode: companion answers start with "(MOCK)" and every upload returns the same sample record. `http://localhost:8000/health` shows which mode it is in.
