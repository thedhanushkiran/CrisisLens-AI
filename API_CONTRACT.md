# CrisisLens API contract

Base URL for local development: `http://localhost:8000/api/v1`. OpenAPI is served at `/docs`.

## Health

| Method | Path | Access | Result |
|---|---|---|---|
| GET | `/health` | Public | API process health |
| GET | `/ready` | Public | API and database readiness; HTTP 503 if the database check fails |

## Reports

### Report fields

```json
{
  "id": "CL-<client-generated-stable-id>",
  "categories": ["Rescue", "Medical"],
  "description": "People are trapped and an adult has a cardiac condition.",
  "request_message": "Please bring drinking water and medicine.",
  "location_text": "Example Road, Example City",
  "landmark": "Optional landmark",
  "latitude": 12.97,
  "longitude": 80.22,
  "coordinates_consented": true,
  "urgency": "Critical",
  "contact_primary": "+1 555 0100",
  "contact_alternate": null,
  "client_sync_status": "queued"
}
```

Categories are `Rescue`, `Medical`, `FoodWater`, `Shelter`, `Missing`, or `Hazard`. Urgency is `Critical`, `Urgent`, or `Moderate`. If coordinates are supplied, both must be in range and consent must be true. Coordinates are discarded unless consent is true.

| Method | Path | Access | Behavior |
|---|---|---|---|
| POST | `/reports` | Public | Create one report; existing ID returns HTTP 409 |
| POST | `/reports/sync` | Public | Idempotent batch sync; accepts 1–100 items |
| GET | `/reports` | Public | Filter by `category`, `urgency`, `review_status`, and `q`; paginate with `limit` (1–100) and `offset`; sort with `sort_by=created_at|urgency` and `sort_order=asc|desc` |
| GET | `/reports/{id}` | Public | Retrieve a public report |
| PATCH | `/reports/{id}` | Responder/admin | Update urgency, review state, or assignment |
| GET | `/responder/reports` | Responder/admin | Responder list including consented coordinates, contact fields, assignment, and notes |
| PATCH | `/responder/reports/{id}` | Responder/admin | Review-state and assignment update; writes an audit event |
| POST | `/responder/reports/{id}/notes` | Responder/admin | Add an internal note; writes an audit event |
| GET | `/responder/audit` | Responder/admin | Read report audit events |
| GET | `/admin/audit` | Admin | Read report audit events |

`PATCH` report body:

```json
{"urgency": "Urgent", "review_status": "in_review", "assigned_to": "Responder A"}
```

Review states are `unreviewed`, `in_review`, `verified`, `rejected`, and `resolved`. Human review state and urgency are distinct from the rule-based triage suggestion.

`request_message` is optional and limited to 2,000 characters. It is stored with the report and returned only on authenticated responder report endpoints. Public report responses and account-owned report summaries omit it. A report message is not transmitted to emergency services.

If an optional citizen account bearer token is supplied to report creation or batch sync, the API links the report to that account. Without a token, reports remain unlinked. Batch sync retains the same stable-ID idempotency behavior.

### Batch synchronization

Request body is an array of report inputs. Each acknowledgement is one of:

```json
{
  "acknowledgements": [
    {
      "client_id": "CL-abc",
      "status": "accepted",
      "server_status": "received",
      "message": "Stored by CrisisLens API; this is not an emergency-services delivery receipt"
    }
  ]
}
```

`status` values are `accepted`, `duplicate`, `invalid`, and `retryable_failure`. Replaying the same client ID and same report data returns `duplicate` without creating a second row. Reusing an ID with different report data returns `invalid`. Clients should remove only accepted or duplicate IDs from their local queue; retain invalid/retryable reports for review or retry.

## Triage

`POST /triage/suggest` accepts `{"description":"...", "categories":["Medical"]}` and returns:

```json
{
  "suggested_priority": "Critical",
  "reasons": ["Description mentions: cardiac"],
  "uncertainty": "high",
  "is_human_decision": false
}
```

This deterministic rule baseline does not claim calibrated accuracy and does not dispatch assets.

## Misinformation claims

| Method | Path | Access | Behavior |
|---|---|---|---|
| POST | `/misinformation/claims` | Public | Create a claim as `unverified` |
| GET | `/misinformation/claims` | Public | List claims; optionally filter by `status` |
| PATCH | `/misinformation/claims/{id}` | Responder/admin | Record a human review |
| GET | `/misinformation/audit` | Responder/admin | Read review audit events |

Statuses: `unverified`, `needs_review`, `corroborated`, `disputed`. `corroborated` and `disputed` require both `evidence` (minimum 10 characters) and `reviewer_decision` (minimum 5 characters). No AI-generated fact verdict is treated as verification.

## Authentication and errors

Send `Authorization: Bearer <configured-token>` on responder/admin routes. Configured responder tokens may use responder routes; admin tokens may use both. Missing/invalid tokens return 401; insufficient role returns 403. Validation errors use FastAPI's HTTP 422 format; missing rows return 404; conflicting create IDs return 409; throttled public writes return 429.

### Citizen profile

| Method | Path | Access | Behavior |
|---|---|---|---|
| POST | `/accounts/register` | Public, rate limited | Create a citizen profile and sign in; returns a bearer session and profile |
| POST | `/accounts/login` | Public, rate limited | Authenticate with email/password; generic 401 on failed login |
| GET | `/accounts/me` | Citizen session | Return the signed-in user's profile |
| GET | `/accounts/me/reports` | Citizen session | List up to 100 reports linked to the signed-in account |
| POST | `/accounts/logout` | Citizen session | Revoke the current session |

Passwords must be at least 10 characters and are stored as salted PBKDF2-SHA256 hashes. The API returns opaque random bearer tokens; only their SHA-256 digests are stored. Sessions expire after 30 days and can be revoked at logout. Citizen sessions cannot access responder/admin endpoints or other users' reports.

Profiles, hashed passwords, account sessions, and reports are persisted in the configured SQL database. Local development uses SQLite. For cloud persistence, deploy the API and configure its server-side `DATABASE_URL` to a hosted PostgreSQL instance, apply Alembic migrations, and use HTTPS. The repository does not provision or host a cloud database.

Public report responses omit contact fields and request messages. Authenticated responder responses include them. Request bodies, passwords, and contact information are not logged by application code. This prototype does not include email verification, password reset, MFA, or production identity management; do not use it for real responder operations without a security review and production auth controls.
