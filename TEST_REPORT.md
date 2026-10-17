# Test report

Validation was run on Windows 11 with Python 3.13.14 and Node 24.21.0.

## Results

- `.\.venv\Scripts\python.exe -m pytest -q backend\tests`: **22 passed**.
- `node.exe .\node_modules\typescript\bin\tsc --noEmit`: **passed**.
- `node.exe .\node_modules\vite\bin\vite.js build`: **passed**.
- `.\.venv\Scripts\python.exe -m alembic upgrade head`: **passed** on local SQLite at `0003_accounts_and_request_message`. Verified 3 existing report rows remained and the account foreign key was present after migration.
- Fresh local SQLite migration from an empty database: **passed** through `0003_accounts_and_request_message`; verified the report-to-account foreign key.
- Frontend initial-load code splitting: current main entry is **259.01 kB (82.07 kB gzip)**, down from the earlier **424.35 kB (110.47 kB gzip)**. The account dialog is an on-demand **6.34 kB (1.97 kB gzip)** chunk; report, responder, map, and other screens are also split.
- Local live smoke checks after starting the current code: frontend returned **HTTP 200**; API health returned **ok**; readiness returned **ready** with database available; OpenAPI docs returned **HTTP 200** and exposed all five account endpoints.

The 22 backend tests cover report creation and contact separation, coordinate/contact validation, list filtering and pagination, stable-ID duplicate synchronization (including account-linked offline sync and request-message persistence), conflicting-ID rejection, citizen account registration/login/session access, authentication and role authorization, responder review/status changes, notes/audit behavior, and evidence-required misinformation review.

## Warnings and unverified areas

- Starlette emits a deprecation warning that `httpx`-backed `TestClient` will prefer `httpx2` in a future release; tests pass.
- The Vite build emits an existing `__dirname` native config-loader warning; the production build completes successfully.
- PostgreSQL was not started for this validation; SQLite migrations and API tests were used.
- Browser-driven account registration, report submission, offline/reconnect synchronization, and the full responder UI workflow have not been automated. Offline queue status and retry are wired to the existing browser storage, but background sync is not implemented.
- API acknowledgement means CrisisLens stored the report; emergency-services delivery and dispatch are not implemented.
