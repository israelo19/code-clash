# Security

CareVault is a hackathon project that became an open-source demo. Read this before you run it anywhere other
than your own laptop.

## The short version

- **It is a demo.** Every record in it is synthetic.
- **It is not HIPAA compliant.** Do not put real health information in it.
- It was reviewed and hardened in November 2026. The list of protections and the list of known limits are both below.

## Reporting a problem

Please do not open a public issue for a security problem.

1. On GitHub, open the repository's **Security** tab and choose **Report a vulnerability**. That sends a private report to the maintainers.
2. If that button is not there, open an issue that says only "I have a security report" and a maintainer will contact you.

We aim to reply within 7 days and to fix confirmed problems within 90 days. There is one supported version: the
`main` branch.

## How the parts fit together

```
browser  ->  web app (port 3000)  ->  backend (port 4000)  ->  AI service (port 8000)
```

- The browser only talks to the web app. The web app passes `/api` requests to the backend.
- The backend checks who is signed in and what they may do. It is the only thing that talks to the AI service.
- The AI service holds the paid API key. It refuses every caller except the backend.
- The backend and the AI service listen on `127.0.0.1` (this machine only) unless you change that.

## What protects it

**Sign-in**
- Passwords are stored as scrypt hashes (N = 2^17, r = 8, p = 1, a random salt each), never as text.
- A correct sign-in creates a session: 32 random bytes, kept in a cookie that page scripts cannot read (`HttpOnly`) and that is not sent on requests from other websites (`SameSite=Strict`). Over HTTPS it is also `Secure` with the `__Host-` prefix. The database stores only a hash of it.
- A session ends after 8 hours, after 30 minutes without use, on sign-out, and when the same browser signs in again.
- A wrong password, an unknown email and a wrong role all get the same answer in the same time.
- Sign-in attempts are limited per account, per address and overall.

**Who may see what**
- Every data route checks the session on the server. A patient can only read and share their own records. The ids in a request never decide who you are.
- A clinician sees a patient's records only by opening a share code, and only the documents in that share. Every document shown is written to the patient's access log.
- A clinician can add a note only for a patient whose share they opened and that is still valid.
- Share codes are made with a cryptographic random generator, expire (a week at most), and can be ended early by the patient. Opening codes is limited to 10 tries per 10 minutes per clinician.
- Requests that change anything must carry a header that other websites cannot add, which blocks cross-site request forgery.

**Uploads and the AI**
- Uploads are limited to 15 MB, to signed-in patients, and to 10 per 10 minutes.
- Only JPEG, PNG, WebP and HEIC photos and PDFs are opened, decided by the file's contents and not by its name. Oversized pictures are refused before they are decoded. Photos are re-saved as plain JPEGs, which drops location data and anything hidden in the file.
- What the AI reads off a document is treated as untrusted. Only the expected fields are kept, cut to fixed lengths, and checked again by the backend before saving.
- The companion is told that records are information, never instructions. It has two tools, both read-only: search the signed-in patient's records, and ask the cost model. It cannot change or send anything.
- The records the companion reads are loaded by the backend for the signed-in patient. The browser cannot choose them.
- Chat is limited to 20 messages per 5 minutes per patient, with limits on message, history and record size. API calls time out after 60 seconds.

**The servers**
- Responses carry security headers: a Content Security Policy, no framing, no content-type guessing, no referrer, and no caching of API answers.
- Other websites get no permission to call the backend (no CORS), and the AI service has none at all.
- Errors sent to the browser are short and say nothing about the code. Details go to the server log.
- SQL is always sent with parameters, never built from text.
- The cost model file is checked against a saved SHA-256 fingerprint before it is loaded.
- Python and Node dependencies are pinned or locked. `npm audit` and the OSV database showed no known vulnerabilities in what ships (checked November 15, 2026).

## Known limits

These are real. Do not treat the list above as "secure enough for patient data".

- **No real accounts.** There is no sign-up, no password reset and no two-step sign-in. Outside demo mode, accounts have to be added by hand with `db.createUser`.
- **Demo mode is public by design.** The demo accounts' password is in this repository. Demo mode also seeds a share code that never expires (`DEMO01`) and lets anyone reset the database. It is off when `NODE_ENV=production`. Never set `DEMO_MODE=1` on a public server.
- **Nothing is encrypted on disk.** The database is a plain SQLite file.
- **Records leave the machine.** Uploaded documents and chat messages are sent to the Anthropic API to be read and answered.
- **The AI can be wrong or misled.** A record is what the AI read from a photo the patient supplied. Nobody checks it against the original, and the original is not kept. A photo can be written to mislead the reader or the companion. The safeguards above reduce this and cannot rule it out. The clinician view says so.
- **Rate limits live in memory.** They reset when the backend restarts and do not work across several backend processes.
- **A visitor's address can be faked** unless a proxy in front of the web app overwrites the `X-Forwarded-For` header. That is why the important limits are per account, not per address.
- **Share codes are six characters** (about a billion possibilities) and appear in the address of the clinician's page, so they end up in that browser's history. The attempt limits are what make guessing impractical.
- **The Content Security Policy allows inline scripts**, because Next.js needs them without per-request nonces. It still blocks scripts, frames and requests from other sites.
- **The model file is a Python pickle.** Loading a pickle from someone you do not trust can run their code. Only load the file `train.py` wrote, and review any pull request that changes it.
- **The training data has real practice addresses.** It is public CMS data about clinicians. A few address lines contain a clinician's name, and a few practices are registered at what look like home addresses. The app only ever shows addresses where at least two clinicians bill.
- **One open advisory in a development tool.** `minimatch`, used by the web app's lint tooling, has a moderate denial-of-service advisory (GHSA-g3hv-75wg-m249) with no compatible fix yet. It is not part of the running app.

## Before you put it on the internet

1. Serve the web app over HTTPS and set `NODE_ENV=production` for the web app and the backend.
2. Keep the backend and the AI service off the public internet. Only the web app should be reachable.
3. Set the same long random `AI_SERVICE_TOKEN` for the backend and the AI service.
4. Put a proxy or platform in front that overwrites `X-Forwarded-For`, and set `TRUST_PROXY` to match it.
5. Set a spending limit on the API key, and use a key made only for this app.
6. Leave `DEMO_MODE` unset.
7. Decide how you will back up, encrypt and delete the database. Nothing here does that for you.

Even with all of that done, this is not a system for real patient records.

## If a secret is ever committed

Revoke or rotate it first. Removing it from the git history afterwards does not make it safe again, because
copies and forks keep it.

## For maintainers

GitHub settings worth turning on (Settings > Advanced Security, and Settings > Rules):

- Private vulnerability reporting, so the "Report a vulnerability" button exists.
- Dependabot alerts and security updates. `.github/dependabot.yml` already asks for weekly version updates.
- Secret scanning push protection.
- A ruleset on `main`: require a pull request, require the CI checks to pass, block force pushes and deletion.
- Two-step sign-in for everyone who can push.
