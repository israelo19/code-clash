# Part B plan: Israel, Molly and a third teammate

Backend and data. Written Saturday November 14, 2:00 PM. Feature freeze is 4:00 PM.

"Teammate 3" is a placeholder. Put their name in.

**Part B is done when** a clinician account opens a shared record by code and the view shows up in the patient's access log.

## Where things stand

- **`molly` branch:** an Express server in `App.js` with one route, `GET /api/device`. `package.json` already has `express`, `cors`, `dotenv` and `nodemon`. No database, users or share codes yet. `node_modules` is committed (951 files) and the branch is 4 commits behind `main`.
- **`main`:** the AI service, a Python FastAPI app in `ai/` with `/extract`, `/chat` and a placeholder `/estimate`.
- **`cost-model` branch:** the finished cost model, not merged yet.
- **Nowhere:** a web front end.

## The approach

Molly's Express server is the Part B backend. It owns all the app's data, and the Python service is a helper it calls.

```
front end  ->  Express server (port 3000)       ->  Python AI service (port 8000)
               users, documents, shares,            reads documents, chats,
               access log, notes                    estimates prices
```

- The front end talks to one address only, the Express server.
- All database code lives in one file with one owner. Everyone else calls its functions and never writes SQL.

## Who does what

| | Israel | Molly | Teammate 3 |
| --- | --- | --- | --- |
| In one line | The database and the hard plumbing | The server and share-by-code | The simple routes, the AI bridge and the demo pages |
| Files | `server/db.js`, `server/routes/upload.js`, `ai/estimate_stub.py` | `server/index.js`, `server/package.json`, `server/routes/shares.js` | `server/routes/patients.js`, `server/routes/ai.js`, `server/public/` |
| Tasks | Database and all its functions. Merge the cost model. Real model behind `/estimate`. Photo upload bridge. Hosting. | Clean up the branch and push the skeleton. Create a share. Open a share with expiry. Access log. Notes if time. | Estimate bridge. Demo accounts, timeline, reset. Chat bridge. Two demo pages. |

Each file has one owner. If you need a change in someone else's file, ask them.

## The contract you all build against

### Database functions (Israel writes these in `server/db.js`)

The database is SQLite through the `better-sqlite3` package, with the five tables from the project brief: `users`, `documents`, `shares`, `access_log`, `notes`.

| Function | Returns |
| --- | --- |
| `listUsers()` | every user: `id`, `role`, `name` |
| `getUser(id)` | one user, or `undefined` |
| `listDocuments(patientId)` | the patient's documents, newest first |
| `getDocuments(ids)` | the documents with those ids |
| `addDocument(patientId, record)` | the saved document, with its new `id` |
| `createShare({ code, patientId, documentIds, expiresAt })` | the saved share |
| `getShare(code)` | the share, or `undefined` |
| `logAccess({ shareCode, viewerId, documentId })` | nothing |
| `listAccessLog(patientId)` | rows of `viewed_at`, `viewer_name`, `document_id`, `document_type`, `share_code`, newest first |
| `addNote({ patientId, clinicianId, text })` | the saved note |
| `listNotes(patientId)` | the patient's notes, newest first |
| `reset()` | puts everything back to the seed |

- Rows come back with the column names from the brief, for example `patient_id` and `expires_at`. `fields` and `document_ids` are already parsed, not JSON text.
- Every time is a UTC string from `new Date().toISOString()`.
- Seeded users: `maya` (role `patient`) and `dr_rivera` (role `clinician`).
- Seeded documents: Maya's three records from `data/sample_records.json`.

### Routes

| Route | Owner | In | Out |
| --- | --- | --- | --- |
| `POST /api/shares` | Molly | `patient_id`, `document_ids`, `minutes` (default 15) | `code`, `expires_at`, `document_ids` |
| `GET /api/shares/:code?viewer_id=dr_rivera` | Molly | nothing | `patient`, `expires_at`, `documents`. Also writes the access log. |
| `GET /api/patients/:id/access-log` | Molly | nothing | the rows from `listAccessLog` |
| `POST /api/notes`, `GET /api/patients/:id/notes` | Molly | `share_code`, `clinician_id`, `text` | the saved note, and the patient's notes. Nice to have. |
| `GET /api/users` | Teammate 3 | nothing | the two demo accounts, for the role switch |
| `GET /api/patients/:id/documents` | Teammate 3 | nothing | the patient's documents, newest first. This is the timeline. |
| `POST /api/reset` | Teammate 3 | nothing | puts the database back to the seed, for demo runs |
| `POST /api/estimate` | Teammate 3 | see `docs/DECISIONS.md` | a price range |
| `POST /api/chat` | Teammate 3 | `patient_id`, `message`, `history` | `reply`, `used_records`, `used_estimates` |
| `POST /api/patients/:id/documents` | Israel | a photo or PDF, form field `file` | the parsed record, saved |

Error replies for opening a share: 404 for a code that does not exist, 410 for an expired code, 403 if the viewer is not a clinician.

## Molly: tasks in order

1. **Clean up the branch and get a skeleton into `main`. Aim for 2:25.** Everyone else is waiting on this. Run these in order; merging first avoids a conflict in `.gitignore`.
   ```
   git checkout molly && git pull
   git merge origin/main
   git rm -r --cached node_modules
   printf "\nnode_modules/\n*.db\n.DS_Store\n" >> .gitignore
   mkdir server
   git mv App.js server/index.js
   git mv package.json package-lock.json server/
   rm -rf node_modules && cd server && npm install
   npm install better-sqlite3 multer
   ```
   - In `server/package.json`, add `"start": "node index.js"` and `"dev": "nodemon index.js"` under `scripts`.
   - In `server/index.js`, add `app.use(cors())`, `app.use(express.json())` and `app.use(express.static("public"))` before the routes. Without the second line, every POST body arrives empty.
   - Create `routes/shares.js`, `routes/patients.js`, `routes/ai.js` and `routes/upload.js`, each exporting an empty `express.Router()`, and mount all four under `/api`.
   - Commit, push, open the pull request into `main`, and merge it.
   - Check: `npm run dev` starts, and `http://localhost:3000/api/device` still answers.
2. **Create a share.** `POST /api/shares` in `routes/shares.js`.
   - Use `getDocuments` to check that every document id belongs to that patient. Refuse with 400 if not.
   - Build a 6-character code with `crypto.randomInt` from characters that cannot be confused: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
   - Set `expiresAt` to now plus `minutes`, then call `createShare`.
   - You can write this before the database file arrives, and run it once it does.
3. **Open a share as a clinician.** `GET /api/shares/:code`.
   - `getShare(code)`. Nothing back means 404.
   - Compare `expires_at` with the server's current time. Past it means 410.
   - `getUser(viewer_id)`. Anyone who is not a clinician gets 403.
   - Call `logAccess` once per document, then return the documents.
   - Check: a share made with `minutes` set to 1 works at first and returns 410 a minute later. That also makes a good live demo of expiry.
4. **Show the access log.** `GET /api/patients/:id/access-log` returns `listAccessLog(id)`. Check: after step 3 it lists the view. At this point Part B is done.
5. **Notes, only if there is time.** Save a note for the share's patient while the code is still valid.

## Israel: tasks in order

1. **Write the database file. Start now; push by 2:30.** Molly and Teammate 3 cannot run their routes without it.
   - `server/db.js` opens `../data/app.db` with `better-sqlite3`, creates the five tables, and seeds when `users` is empty.
   - Write every function in the contract table above. Each is two to four lines: `db.prepare(sql).run(...)` to write, `.get(...)` for one row, `.all(...)` for many.
   - `listAccessLog` is the one real query: join `access_log` to `shares` to find the patient's rows, and to `users` and `documents` for the names.
   - It is a new file, so it merges cleanly as soon as Molly's skeleton is in `main`. Do not edit `package.json`; Molly's skeleton already installs `better-sqlite3`.
   - Check: `node -e "console.log(require('./db').listDocuments('maya').length)"` prints 3.
2. **Merge `cost-model` into `main` and push.** `.gitignore` and `ai/requirements.txt` conflict because both branches created them. Keep the lines from both sides in each. Check: `python -m pytest ai/tests` passes.
3. **Wire the trained model into `/estimate`.** Replace the inside of `estimate()` in `ai/estimate_stub.py` with a call to `model.predict.estimate`, and take the service list from the model so the TB test disappears. Keep the output keys the companion reads (`service_code`, `service`, `low`, `typical`, `high`, `caveat`). Check: ask the companion "how much is a strep test" and the reply no longer says PLACEHOLDER.
4. **Bridge the photo upload.** `POST /api/patients/:id/documents` in `routes/upload.js`.
   - Use `multer` with memory storage to receive the file.
   - Re-send it to the Python service's `/extract` as form data: wrap `req.file.buffer` in a `Blob` and append it to a `FormData` as `file`. Do not send `patient_id`, so Python does not keep its own copy.
   - Save the returned record with `addDocument` and reply with it.
   - Check: upload `data/demo/sample_visit_summary.png`, and the timeline shows four documents.
5. **Hosting, after 4:00 and only if the loop works.** It is not a feature, so it can follow the freeze. Two services need a host. If it is not working by 4:30, demo from one laptop.

## Teammate 3: tasks in order

1. **Get both services running. Do this while Molly pushes the skeleton.**
   - Follow "Run it" in `ai/README.md` to start the Python service on port 8000. Leave the API key empty; mock mode is enough.
   - Once the skeleton is in `main`: `git pull`, `cd server`, `npm install`, `npm run dev`.
2. **Bridge the estimate.** `POST /api/estimate` in `routes/ai.js`. Read the Python address from an `AI_URL` setting that defaults to `http://localhost:8000`, forward the request body to `AI_URL/estimate` with `fetch`, and return the reply. It needs no database, so it can be tested right away. Check: `curl -X POST localhost:3000/api/estimate -H "Content-Type: application/json" -d '{"service_code":"87880"}'` returns a price range.
3. **Demo accounts, timeline and reset.** In `routes/patients.js`, three short routes that each return one database function: `GET /api/users` returns `listUsers()`, `GET /api/patients/:id/documents` returns `listDocuments(id)`, and `POST /api/reset` calls `reset()`. Check: the timeline returns three documents for `maya`.
4. **Bridge the chat.** `POST /api/chat` in `routes/ai.js`. Call `listDocuments(patient_id)`, then post `message`, `patient_id`, `history` and those documents as `records` to `AI_URL/chat`. Check: a question about the immunization record names `doc_imm001` in `used_records`.
5. **Two demo pages, if nobody else is building the front end.** Plain HTML files in `server/public/`, which the Express server serves.
   - A patient page: list the timeline with a checkbox per document, a "Share" button that calls `POST /api/shares` and shows the code, and the access log underneath.
   - A clinician page: a box to enter the code, and the shared documents shown below it.

## Testing without a front end

```
curl -X POST localhost:3000/api/shares -H "Content-Type: application/json" \
     -d '{"patient_id":"maya","document_ids":["doc_imm001"],"minutes":15}'
curl "localhost:3000/api/shares/THECODE?viewer_id=dr_rivera"
curl localhost:3000/api/patients/maya/access-log
```

## Schedule

| Time | Israel | Molly | Teammate 3 |
| --- | --- | --- | --- |
| 2:00 to 2:30 | Database file | Clean up, skeleton into `main` | Run both services, then the estimate bridge |
| 2:30 to 3:00 | Merge the cost model, real model behind `/estimate` | Create a share, open a share | Demo accounts, timeline, reset |
| 3:00 to 3:25 | Photo upload bridge | Access log, then test the whole share flow | Chat bridge |
| 3:25 to 3:45 | Finish the upload, help connect the pieces | Notes if time, or help with the pages | The two demo pages |
| 3:45 to 4:00 | Run the demo script twice together | Run the demo script twice together | Run the demo script twice together |

The 3:00 workshop and the 3:30 mini challenge fall inside this. Decide now who goes to each.

## Working without collisions

- Molly's skeleton goes into `main` first, even though it does nothing yet. After that, everyone pulls `main` and works only in their own files.
- Push small and often. Merge into `main` as soon as a task's check passes.
- Only Molly edits `server/package.json`. If you need another package, ask her to add it.

## Things to know

- **Israel's list is the longest and the database comes first on it.** Two people wait on that file. If it slips past 2:30, say so early.
- **The front end is the gap.** No web code is in the repo. Part B only shows in the demo once the two pages in Teammate 3's last task exist, or someone else builds them.
- **The device route is not on the critical path.** A layout that adapts to phones is done in the page's CSS, so the server does not need to detect the device. Keep the route, but do not spend more time on it.
- **There is no real login.** The client sends `viewer_id`, so anyone could claim to be the clinician. That is fine for a demo with seeded accounts; say so if a judge asks.
- **Do not claim encrypted storage.** The brief's Q&A lists it, but nothing here encrypts documents. Say it is in the design, not in the build.
- **README disclosures.** Add Express, `cors`, `dotenv`, `better-sqlite3`, `multer`, `nodemon` and `node-device-detector` to the list.
