# Web app (Workstream A)

Next.js + TypeScript + Tailwind. Responsive: bottom tabs on phones, sidebar on laptops.
Runs entirely on mock data right now, so the whole demo loop clicks through before the backend and AI service exist.

## Run it

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. To test on your phone, open `http://<your-laptop-ip>:3000` on the same Wi-Fi, or deploy to Vercel.

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
| `app/patient/cost/` | Cost estimate ranges by care setting |
| `app/patient/chat/` | Companion chat with the "not a doctor" line |
| `app/patient/share/` | Create expiring share codes and view the access log |
| `app/clinician/` | Enter a share code |
| `app/clinician/view/[code]/` | Shared records and adding a visit note |
| `components/AppShell.tsx` | Navigation, role check |
| `components/ui.tsx` | Cards, timeline item, cost range card, chat bubble |
| `lib/types.ts` | Data shapes. Agree on these with B, C and D |
| `lib/api.ts` | **The only file to change when the real backend is ready** |
| `lib/mockData.ts` | Synthetic demo data |
| `lib/config.ts` | App name, companion name, disclaimer text |

## Connecting the real backend

Every screen calls functions in `lib/api.ts`. Replace the inside of each one with a `fetch()` to the real route and keep the same return type. For example:

```ts
export async function listDocuments(patientId: string) {
  const res = await fetch(`/api/documents?patient_id=${patientId}`);
  return res.json();
}
```

## Demo notes

- Mock data is saved in the browser, so a patient tab and a clinician tab in the same browser share it. Use "Reset demo data" at the bottom of the landing page before presenting.
- Sign-in uses the two seeded demo accounts. Their email and password are in `DEMO_LOGINS` in `lib/mockData.ts`, and the sign-in pages fill them in for you. `checkLogin` in `lib/api.ts` does the check.
- Code `DEMO01` always opens Maya's immunization record and physical form.
- The mock upload always returns the strep visit summary, whatever image you pick.
- The mock companion answers questions about strep, vaccines, and the visit summary. Urgent words (chest pain, trouble breathing) trigger the "call 911" reply.
