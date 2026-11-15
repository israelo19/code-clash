# Contributing

Thanks for looking. CareVault is a small demo project, so the process is light.

## Before you start

- Found a security problem? Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- For anything bigger than a small fix, open an issue first so we can agree on the approach.

## Making a change

1. Fork the repository and make a branch.
2. Set the project up as the [README](README.md) describes.
3. Make the change. Keep it small and focused on one thing.
4. Run the checks. All of them must pass:

   ```bash
   npm test
   .venv/bin/python -m pytest ai/tests
   (cd web && npx next typegen && npx tsc --noEmit && npm run lint && npm run build)
   ```

5. Open a pull request that says what changed and why.

## Rules that keep the project safe

- **Never commit secrets.** No API keys, tokens or passwords, and no `.env` file. If you commit one by mistake, tell a maintainer and revoke it. Deleting the commit is not enough.
- **Never commit real health information.** Every record here is synthetic. Keep it that way, in code, tests, screenshots and issues.
- **New routes check who is asking.** Every backend route that returns or changes data uses `requireUser` or `requireSelf` from `server/security.js`, and has a test showing that a stranger and the wrong user are refused.
- **Treat everything from outside as untrusted.** That means the browser, uploaded files, and what the AI model returns. Validate it (`server/validate.js`, `ai/extract.py`) before using or storing it.
- **Do not change `ai/model/cost_model.joblib` by hand.** It is rebuilt by `python ai/model/train.py`, which also writes its fingerprint. A pull request that changes it should come with the code or data change that explains why.
- **Think before adding a dependency.** Every new library is code we then have to trust. Pin Python versions in `ai/requirements.txt` and commit the npm lockfile.
- **GitHub Actions are pinned to a full commit ID.** Keep it that way when you add or update one.

## Style

Write code and comments so that someone new to the project can follow them: plain names, short functions, and a
comment where the reason is not obvious.
