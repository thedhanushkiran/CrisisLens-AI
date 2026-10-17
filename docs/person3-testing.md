
# Person 3 — Offline Storage and Cache Testing

## Project
CrisisLens AI

## Module Responsibilities
- SQLite local database initialization
- Persistent emergency report storage
- Durable outbox and pending-request queue
- Offline resource caching
- Cache expiry and cleanup
- Offline recovery testing

## Implemented Components

### 1. Database
File: `src/storage/database.ts`

Creates tables for emergency reports, the outbox queue, and cached resources.

### 2. Outbox
File: `src/storage/outbox.ts`

Provides functions to save emergency reports locally, retrieve pending reports, schedule retries, and record server delivery acknowledgements.

### 3. Resource Cache
File: `src/storage/cache.ts`

Stores optional text resources, expires stale entries, removes older cached resources when the configured limit is exceeded, and reports cache usage.

### 4. Emergency Instructions
File: `src/constants/emergencyInstructions.ts`

Contains essential emergency instructions bundled with the application for offline access.

## Test Checklist

| Test | Expected Result | Status |
|---|---|---|
| Database initialization | Required tables are created | Not tested |
| Save emergency report | Report and outbox entry are saved | Not tested |
| App restart | Saved report remains available | Not tested |
| Offline submission | Report remains pending locally | Not tested |
| Failed delivery | Retry is scheduled | Not tested |
| Server acknowledgement | Report becomes server received | Not tested |
| Cache expiry | Expired resources are unavailable | Not tested |
| Cache size management | Optional resources are cleaned up safely | Not tested |

## Known Limitations

- Runtime testing is required before confirming these features work.
- Database encryption and secure key management must be reviewed before production.
- Essential emergency instructions are bundled with the app.
- Actual peer-to-peer networking and server synchronization are handled by other modules.
- Pending emergency reports must never be deleted by optional cache cleanup.

## Test Environment

- Platform: To be recorded
- Device: To be recorded
- Test date: To be recorded

## Final Result

Implementation and runtime testing must be completed before this module is considered production-ready.
