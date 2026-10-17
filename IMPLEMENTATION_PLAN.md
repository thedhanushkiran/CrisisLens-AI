# Implementation status and next steps

## Delivered in this iteration

- FastAPI service, environment-based settings, SQLAlchemy 2.x models, Alembic migrations, and SQLite fallback with optional PostgreSQL.
- Public report create/read/list/filter endpoints, safe pagination/sorting, contact-field separation, consent checks, and stable-client-ID batch synchronization.
- Rule-based triage suggestions separated from submitted urgency and responder decisions.
- Shared-token responder/admin authorization for review updates, assignments, internal notes, and audit records.
- Evidence-required misinformation review states with a separate audit trail.
- Citizen account registration/login with salted password hashes, expiring/revocable sessions, owner-linked reports, and request messages visible only to authorized responders.
- Browser-local report queue connected to batch sync; only API-acknowledged IDs leave the queue.
- Responder UI loading and review actions connected to the API; claim submission/review connected to the API.
- Windows-specific setup instructions, contract, tests, seed records, and optional local PostgreSQL Compose service.

## Deliberate prototype constraints

- Shared local responder/admin tokens are not production identity or per-user authorization.
- Citizen profiles use the configured database; cloud persistence still requires the developer to deploy the API and connect a hosted PostgreSQL database. No cloud resource is provisioned by the repository.
- Citizen authentication is a prototype without email verification, password reset, or MFA; require a production identity provider and security review before operational use.
- Browser `localStorage` is unencrypted. No encryption-at-rest or secure client storage is implemented.
- Rate limiting is process-local and resets on restart.
- No automatic background sync, peer-to-peer mesh, SMS, radio, satellite, map-tile cache, external verification source, image analysis, or emergency-services dispatch exists.
- Existing dashboard/map/fleet visualizations still contain demo-only content. Server-backed reports and review actions are distinguished from these examples.

## Highest-value next tasks

1. Deploy the API and configure a hosted PostgreSQL instance, HTTPS, and production CORS origins.
2. Replace prototype citizen/responder authentication with a production identity provider, add email verification, password recovery, MFA, and stronger abuse prevention.
3. Protect sensitive fields in storage and transport; add data retention and deletion policies before handling real incidents.
4. Add browser integration tests for offline queue persistence, reconnect synchronization, duplicate acknowledgement, and the responder review UX.
5. Add robust PostgreSQL integration/transaction tests and distributed rate limiting before deployment.
6. Replace demo-only map, asset, notification, and dashboard content with verified source integrations only when available.
