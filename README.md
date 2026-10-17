# CrisisLens AI

CrisisLens is a disaster-report intake and responder-review prototype. It can store reports in the browser, synchronize them to a FastAPI service, and record authenticated human reviews. It is **not** an emergency dispatch service and does not contact 911/112 or emergency responders.

## Windows 11 and VS Code setup

Open the repository folder in VS Code. The repository path contains `&`; in Windows PowerShell, use the commands below as written rather than entering an unquoted path in `cmd.exe`.

### 1. Install prerequisites

- Node.js 20.19+ (the project was checked with Node 24).
- Python 3.11+ (the project was checked with Python 3.13).
- Optional: Docker Desktop for PostgreSQL. SQLite is the default local fallback.

Open a VS Code PowerShell terminal at the repository root:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd install
Copy-Item .env.example .env
notepad .env
```

If the Windows Python launcher is not installed, create the environment with your Python 3.11+ executable instead:

```powershell
& "C:\Path\To\Python\python.exe" -m venv .venv
```

In `.env`, replace the local-only responder/admin token placeholders with values of your own. They are demo credentials, not production authentication. Never commit `.env`.

### 2. Database

**SQLite fallback (default):** no database server is required. The API uses `sqlite:///./crisislens.db`; the file is created in the repository when migrations run.

**Optional PostgreSQL:**

```powershell
docker compose up -d postgres
```

Set `DATABASE_URL` in `.env` to:

```text
postgresql+psycopg://crisislens:local-development-only@localhost:5432/crisislens
```

The Compose credentials are for local development only. Replace them before sharing or deploying the service.

Apply schema migrations and add clearly labeled demonstration reports:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m backend.scripts.seed_demo
```

The seed script is idempotent and creates only records prefixed `DEMO-`.

### 3. Start the backend and frontend

Use two VS Code terminal windows, both at the repository root.

**Terminal 1 — FastAPI backend:**

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

- OpenAPI / Swagger UI: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/v1/health>
- Readiness (includes a database check): <http://localhost:8000/api/v1/ready>

**Terminal 2 — existing React/Vite frontend:**

```powershell
$env:PORT = "8080"
node.exe .\node_modules\tsx\dist\cli.mjs server.ts
```

Open <http://localhost:8080> or use the repository's VS Code launch configuration. The Node development server embeds Vite and reads `VITE_API_BASE_URL` from `.env`.

On this Windows workspace, `npm.cmd run dev` currently fails because npm's generated Windows script environment mishandles the `&` in the repository path. The direct Node command above avoids that shell limitation. Dependency installation and the frontend build do work with `npm.cmd`.

In the Responder Command view, enter the `RESPONDER_API_TOKEN` from `.env` and click **Connect** to load server reports. The token is held only in the current browser tab's `sessionStorage`. It is a development-only shared bearer token, not production user identity or session management.

Use **Sign in** in the top navigation to create a citizen profile or sign in. Names, email, optional phone, salted password hashes, and sessions are stored by the configured API database. Signed-in reports submitted or synchronized through the form are associated with that account. **View my synchronized reports** lists reports linked to the signed-in account. Citizen sessions do not grant responder access.

**Cloud persistence:** local development defaults to SQLite, so accounts and reports remain on this machine. To persist them in the cloud, deploy this FastAPI service and configure `DATABASE_URL` as a secret on the API host to a hosted PostgreSQL URL, for example `postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require`. Set the frontend's `VITE_API_BASE_URL` to the deployed API URL and configure that API's `CORS_ORIGINS` for the exact frontend origin. Run `alembic upgrade head` against the hosted database before accepting registrations. No cloud service is provisioned by this repository, and database credentials must never be placed in frontend variables or committed.

### 4. Frontend and backend checks

```powershell
.\.venv\Scripts\python.exe -m pytest -q backend\tests
.\.venv\Scripts\python.exe -m alembic upgrade head
node.exe .\node_modules\typescript\bin\tsc --noEmit
node.exe .\node_modules\vite\bin\vite.js build
```

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./crisislens.db` |
| `CORS_ORIGINS` | Comma-separated exact browser origins | `http://localhost:3000,http://localhost:8080` |
| `RESPONDER_API_TOKEN` | Local responder bearer token | Empty (responder routes return 401) |
| `ADMIN_API_TOKEN` | Local administrator bearer token | Empty (admin routes return 401) |
| `RATE_LIMIT_PER_MINUTE` | Per-process limit for public write routes | `120` |
| `VITE_API_BASE_URL` | Browser API base URL | `http://localhost:8000/api/v1` |

## Data, privacy, and operational limits

- Public report responses omit primary and alternate contact fields. Authenticated responder responses can include them.
- Coordinates are optional and are only stored when the client submits both coordinates and `coordinates_consented: true`.
- Browser reports and contact information use `localStorage`, which is **not encrypted**. Do not use real sensitive data in this prototype.
- Account sessions are held in browser `sessionStorage`; sessions expire after 30 days and logout revokes the current token. Registration uses PBKDF2-SHA256 password hashes. This prototype has no email verification, password reset, or MFA.
- Emergency request messages are stored with reports and shown to authenticated responders. They are not broadcast or delivered to emergency services.
- API acknowledgement confirms storage by CrisisLens only; it does not mean that emergency services received the report or dispatched a unit.
- Triage is an explainable keyword-rule baseline. It returns suggested priority, reasons, and uncertainty; it does not set the human urgency decision or dispatch assets.
- Responder/admin authentication is a configured shared bearer token for a single-developer demonstration. Use a production identity provider, secret management, TLS, encryption at rest, and per-user authorization before real deployment.
- Rate limiting uses in-memory per-process counters. It is a development safeguard, not distributed abuse protection.
- Responder asset/fleet panels are demonstration placeholders. Review and assignment are stored by the API, but no live fleet telemetry or external dispatch action is connected.
- No peer mesh, SMS, satellite, VHF, offline map tile, image-analysis, or external emergency-services integration is implemented.

The main UI screens are loaded on demand, so the initial browser load does not include the responder, map, and review screens until opened.

See [API_CONTRACT.md](./API_CONTRACT.md), [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), and [TEST_REPORT.md](./TEST_REPORT.md).
