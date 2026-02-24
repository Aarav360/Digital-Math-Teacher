# Project Knowledge Base

## System Architecture
- Monorepo with a Next.js (App Router) frontend and a FastAPI backend.
- Backend is a modular monolith: routers -> deps -> services -> ORM models -> Postgres.
- Frontend is feature-sliced by route, with a whiteboard feature under a single route folder.
- Contracts are defined in backend Pydantic schemas and mirrored in frontend TypeScript types.
- Persistence is PostgreSQL with Alembic migrations.

## Key Abstractions
- Session: a user’s work context, optionally linked to a Problem; includes status and title.
- Problem: canonical math prompt with metadata and (optional) canonical solution.
- CanvasSnapshot: immutable snapshot of whiteboard state (JSONB payload + dimensions).
- Step and StepEvaluation: per-step analysis artifacts (currently stubbed).
- ChatMessage: persisted chat history items (currently stubbed in streaming).
- Whiteboard canonical state: owned by `useWhiteboardContent` and mutated via `useWhiteboardHistory` only.
- API client: `frontend/src/lib/api.ts` is the single fetch wrapper and type source for endpoints.

## Naming Conventions
- Backend modules: `app/api/v1/*` for routes, `app/models/*` for ORM, `app/schemas/*` for request/response.
- API endpoints are all under `/api/v1` and use plural resource names.
- DB tables are plural snake_case: `users`, `sessions`, `canvas_snapshots`, `step_evaluations`.
- Frontend features live under `frontend/src/app/(app)/<feature>`.
- Whiteboard hooks are prefixed with `use` and live under `session/[id]/hooks`.
- Environment variables:
  - Backend: `DATABASE_URL`, `SECRET_KEY`, optional `OPENAI_API_KEY` and storage config.
  - Frontend: `NEXT_PUBLIC_API_URL`.

## Patterns To Follow
- Keep API contracts in sync: update Pydantic schema + frontend types together.
- Use `api.ts` for all frontend HTTP calls; do not call `fetch` directly in pages/hooks.
- Keep whiteboard state mutations routed through history operations to preserve undo/redo.
- Prefer immutable snapshot writes for canvas persistence; do not mutate existing snapshots.
- Enforce ownership checks in backend routes using deps and session user_id filters.
- Add Alembic migrations for any DB schema change.
- Validate JSONB payloads like `strokes_json` at ingest (schema + size limits), with a backfill/compat plan for existing records.

## Patterns To Avoid
- Bypassing `useWhiteboardHistory` to mutate canvas state directly.
- New ad-hoc fetch wrappers or duplicate API base URL logic.
- Endpoint-specific auth handling that ignores the shared deps in `app/api/deps.py`.
- Large JSON payloads without size constraints or validation.
- N+1 query patterns in list endpoints.

## Critical Coupling Points
- `frontend/src/lib/api.ts` <-> `backend/app/schemas/*`: shape alignment is required.
- `frontend/src/lib/auth.ts` <-> `backend/app/core/security.py`: token format and expiry.
- Whiteboard persistence:
  - `useSnapshotPersistence` assumes snapshot JSON shape with keys `strokes`, `shapes`, `textItems`, `imageItems`.
  - Backend stores `strokes_json` as JSONB without validation, so client shape changes are breaking.
  - Planned fix: add server-side schema validation and max-size enforcement for `strokes_json`, plus a compatibility window to normalize/backfill existing rows. Owner: Backend. Target: 2026-04-30.
- Session status lifecycle is assumed by analysis flow and UI; changing enum values affects both sides.
- LocalStorage migration keys use `WHITEBOARD_STORAGE_KEY_PREFIX` and user id; changes break migration.
