# Digital Math Teacher – Backend

FastAPI backend for the Digital Math Teacher app. Provides problems, sessions, canvas snapshots, step analysis (stub), and streaming chat (stub).

## Setup

1. **Python 3.11+** and a **PostgreSQL** database.

2. **Copy env and install deps:**
   ```bash
   cp .env.example .env
   pip install -r requirements.txt
   ```

3. **Set `.env`:**
   - `DATABASE_URL`: e.g. `postgresql+asyncpg://postgres:postgres@localhost:5432/digital_math_teacher`
   - `SECRET_KEY`: use `openssl rand -hex 32` in production

4. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

5. **Run the app:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

API base: `http://localhost:8000/api/v1`  
Docs: `http://localhost:8000/docs`

## Auth

- **Guest token:** `POST /api/v1/auth/guest` → returns `access_token` (no auth header).
- **Authenticated requests:** `Authorization: Bearer <access_token>`.
- **Current user:** `GET /api/v1/auth/me`.

## Endpoints (all under `/api/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| POST | /auth/guest | No | Create guest user and token |
| GET | /auth/me | Yes | Current user profile |
| GET | /problems | No* | List problems (filter: topic, difficulty, type, search) |
| GET | /problems/{id} | No* | Get one problem |
| POST | /sessions | Yes | Create session (body: problem_id) |
| GET | /sessions | Yes | List sessions (sort: recent, name, topic) |
| GET | /sessions/{id} | Yes | Get session with problem |
| PATCH | /sessions/{id} | Yes | Update session (e.g. status) |
| POST | /canvas/snapshot | Yes | Upload snapshot (session_id, strokes, width, height) |
| POST | /analysis/steps | Yes | Analyze steps (body: session_id, optional snapshot_id) |
| POST | /chat | Yes | Send message (SSE stream) (body: session_id, message, include_steps) |
| GET | /chat/{session_id} | Yes | Chat history |

*Problems can be made auth-required later.

## Seed data

Create a Postgres DB and run migrations. To seed problems, use the API or a one-off script that inserts into `problems` (and optionally creates a guest user and session for testing).
