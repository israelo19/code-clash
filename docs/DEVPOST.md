# Devpost submission text

Copy each part into the matching Devpost field. Anything in [square brackets] is for you to fill in.
Submit by 5:45 PM at https://code-clash.devpost.com/

## Project name

CareVault

## About the project (the big story box, Markdown works)

```markdown
## Inspiration

We are students managing our own health care for the first time, and three things keep getting in the way.

- **Cost.** 40% of adults under 30 skipped or postponed care they needed in the past year because of cost (KFF, 2026).
- **No price up front.** Only 17% of U.S. adults say they know what their care will cost before they get it (Gallup, 2024).
- **Asking AI first.** In an Aflac survey of employed adults, 76% of Gen Z said they use AI for health support before seeking professional medical care (2026).

A general chatbot does not know your records or what a clinic near you charges. So paperwork gets lost, visits get skipped, and class and work get missed. That is our answer to "Break the Barrier": for students and young adults managing their own health care, unknown prices and lost paperwork lead to skipped care. CareVault is a patient-owned records vault, a trained cost estimator and an AI companion, so care stops derailing school and work.

## What it does

CareVault follows one loop around a clinic visit. Our demo patient is Maya, a sophomore who thinks she has strep.

- **Before the visit: see the price.** Pick a service and type a ZIP code. You get an estimated cost with a likely range, for your area and for nearby clinics, cheapest first.
- **During the visit: share by code.** Pick the records to share and how long the code lasts. The clinician enters the code, sees only those records, and can add a visit note. You see a log of who viewed what.
- **After the visit: photo to timeline.** Take a photo of the paperwork. The AI reads it, labels it, pulls out the key facts, explains it in plain language and files it on your timeline.
- **Any time: ask the companion.** It answers from your own records and our cost model, lists what it used under every answer, and tells you it is not a doctor. Urgent symptoms get "call 911".

## How we built it

Three services that talk to each other:

- **Web app:** Next.js, React, TypeScript and Tailwind. It works on a phone and on a laptop.
- **Backend:** Node.js and Express with a SQLite database for users, records, share codes, the access log and notes.
- **AI service:** Python and FastAPI. The companion is Claude with two tools: one searches the patient's records and one calls our cost model. A document reader turns a photo into a structured record.

**The cost model is ours.** We trained it today with scikit-learn on public 2024 Medicare billing data for Maryland from CMS: 15,771 rows covering six common services. It predicts a low, typical and high price. We held out 20% of providers for the final test, so it is scored on clinics it never saw.

- Average error: $32.25, against $44.72 for the baseline (the median price per service). That is 28% lower.
- 83% of real primary-care charges fell inside the range the app shows.
- 52% of estimates landed within 10% of the real charge. The baseline manages 33%.

56 automated tests cover the cost model, the database and the backend routes.

## Challenges we ran into

- **Our first model barely beat the baseline.** Then we found that providers at the same clinic bill the same price: the typical gap is under 0.1%, against 19.5% across the state. Teaching the model each clinic's price level gave most of the gain.
- **Being honest about what the data can tell us.** The data cannot tell a campus clinic from urgent care, so we removed the "care setting" picker instead of showing differences we could not back up. We also dropped one service that had too few rows.
- **The public data API kept dropping connections,** so the data pull retries and checks its row counts against the source.
- **Joining four people's work in the last hours.** Two services wanted the same port, records lived in two places, and the share routes had to be fixed before they would load. Everything now runs on one database.

## Accomplishments that we're proud of

- A model we trained and tested ourselves, with its error reported next to a baseline.
- The whole loop works end to end through the real services: cost check, upload, companion, share code, clinician note and access log.
- A companion that shows its sources and will not diagnose.
- Privacy built in from the start: the patient picks what to share, codes expire, and every view is logged.

## What we learned

- Build the simple baseline first. Without it we would not have known our first model was weak.
- Test on providers the model has never seen, or the score flatters you.
- Agree on data shapes and ports early. Most of our merge pain came from small mismatches.
- Checking statistics on the original page matters. Two numbers we started with turned out to be out of date or loosely worded.

## What's next for CareVault

- More services and more states. The data is public, so this is mostly a bigger data pull.
- What your own insurance plan would pay, not only billed charges.
- Real accounts, encryption and the full HIPAA work needed before real patient data.
- Clinic names, and using your phone's location to fill in the ZIP code.

## Limits and disclosures

- Every record in the demo is synthetic. Sign-in is a demo account. CareVault is not HIPAA compliant today.
- Prices are charges billed to Medicare in 2024, before insurance. They are estimates, always shown as a range, never a quote.
- The companion is not a doctor and does not diagnose.
- **Dataset:** CMS, "Medicare Physician & Other Practitioners by Provider and Service", 2024, Maryland.
- **APIs:** Anthropic Claude API (companion and document reader), CMS open data API.
- **Libraries:** Next.js, React, Tailwind CSS, TypeScript, ESLint, Express, cors, dotenv, node-device-detector, nodemon, FastAPI, Uvicorn, the Anthropic Python SDK, scikit-learn, pandas, joblib, matplotlib, requests, python-dotenv, python-multipart, Pillow, pillow-heif, pytest.
- **AI tools:** Claude Code helped write and debug code across the project (the cost model, the database layer and connecting the services) and helped research sources for the video and slides. Every teammate can explain the code in their part. [Add any other AI tools a teammate used.]
```

## Built with (type these as tags)

python, fastapi, scikit-learn, pandas, next.js, react, typescript, tailwindcss, node.js, express, sqlite, claude, anthropic, cms-open-data

## Try it out (links)

- GitHub repo: https://github.com/israelo19/code-clash
- Slides: [link to the deck, once it is shared]
- Demo video: [link after you upload it]

## Other fields

- **Track:** [Community & Social Impact, or AI & Data. The brief said to switch to AI & Data if the trained cost model became the strongest part of the demo. Every team is also entered for Best Overall.]
- **Teammates:** add Israel, Mercy, Michael and Molly by their Devpost accounts.
- **Image:** `docs/brand/png/logo-full.png` for the logo, plus screenshots of the cost screen, the companion answer and the share screen.

## Where the numbers come from

- The three statistics and their links: `docs/VIDEO_SCRIPT.md`, sources 2, 3 and 4.
- The cost model results: `docs/DECISIONS.md` and `ai/model/metrics.json`.
