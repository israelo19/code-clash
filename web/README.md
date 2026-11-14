# Web app (Workstream A)

Next.js + TypeScript + Tailwind. Responsive: bottom tabs on phones, sidebar on laptops.
The screens call two services. The backend (`../App.js`, port 4000) keeps records, share codes, the access log and
clinician notes in its database. The AI service (`../ai`, port 8000) runs the companion chat, the document reader and the
trained cost model.

## Run it

Three terminals. The full steps are in the README at the top of the repo.

```bash
# 1. AI service, port 8000
cd ai
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Backend, port 4000 (from the repo root)
npm start

# 3. Web app, port 3000
cd web
npm install
npm run dev
```

If the services are hosted somewhere else, set `NEXT_PUBLIC_API_URL` (backend) and `NEXT_PUBLIC_AI_URL` (AI service)
before `npm run dev` or `npm run build`.

## Deploy (Vercel)

1. Push the repo to GitHub.
2. On vercel.com, choose **Add New → Project**, import the repo, and set **Root Directory** to `web`.
3. Click Deploy. Every push to the main branch redeploys.

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
| `components/AppShell.tsx` | Navigation, role check |
| `components/ui.tsx` | Cards, timeline item, cost range card, chat bubble |
| `lib/types.ts` | Data shapes. Agree on these with B, C and D |
| `lib/api.ts` | Every call to the backend and the AI service. The only file that knows their addresses |
| `lib/mockData.ts` | Demo accounts and their sign-in details, the service list |
| `lib/config.ts` | App name, companion name, disclaimer text |

## Demo notes

- Records, share codes, notes and the access log are in the backend's database, so a patient on a phone and a clinician on a laptop see the same data. Use "Reset demo data" at the bottom of the landing page before presenting.
- Sign-in uses the two seeded demo accounts. Their email and password are in `DEMO_LOGINS` in `lib/mockData.ts`, and the sign-in pages fill them in for you. `checkLogin` in `lib/api.ts` does the check.
- Code `DEMO01` always opens Maya's immunization record and physical form.
- A photo to upload is in `../data/demo/sample_visit_summary.png`.
- With no API key the AI service runs in mock mode: companion answers start with "(MOCK)" and every upload returns the same sample record. `http://localhost:8000/health` shows which mode it is in.
