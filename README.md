# Digital Math Teacher

A full-stack app for practicing math with an interactive canvas, step-by-step analysis, and tutor chat. The frontend is a Next.js app; the backend is a FastAPI service with PostgreSQL.

## Project structure

```
Digital Math Teacher/
├── backend/          # FastAPI API (Python 3.11+, PostgreSQL)
├── frontend/         # Next.js app (React, TypeScript, Tailwind)
├── .envrc            # Optional: conda env activation (digital-math-backend)
└── README.md         # This file
```

## Prerequisites

- **Backend:** Python 3.11+, PostgreSQL
- **Frontend:** Node.js 18+ (npm, yarn, pnpm, or bun)
- Optional: [direnv](https://direnv.net/) and Conda (see `.envrc` for backend env)

## Quick start

1. **Backend** (from repo root):
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env: set DATABASE_URL and SECRET_KEY (see Backend setup below)
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   API: http://localhost:8000/api/v1  
   Docs: http://localhost:8000/docs

2. **Frontend** (in another terminal):
   ```bash
   cd frontend
   pnpm install   # or npm install
   pnpm dev       # or npm run dev
   ```
   App: http://localhost:3000

The frontend is configured to call the backend at `http://localhost:8000` (CORS allows `localhost:3000`).

---

## Backend setup

- **Python:** 3.11+ (Conda env `digital-math-backend` is used if you have `.envrc` with direnv).
- **Database:** Create a PostgreSQL database and set in `.env`:
  - `DATABASE_URL`, e.g. `postgresql+asyncpg://postgres:postgres@localhost:5432/digital_math_teacher`
  - `SECRET_KEY`: e.g. `openssl rand -hex 32` for production.
- **Migrations:** `cd backend && alembic upgrade head`
- **Run:** `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### Database migrations

| # | File | Description |
|---|------|-------------|
| 001 | `001_initial.py` | Initial schema: users, problems, sessions, steps, canvas_snapshots, chat_messages |
| 002 | `002_sessions_status_enum.py` | Convert `sessions.status` from VARCHAR to native Postgres enum |
| 003 | `003_sessions_nullable_problem_add_title.py` | Make `sessions.problem_id` nullable (blank whiteboards); add `sessions.title VARCHAR(512)` |

### Auth

- **Guest token:** `POST /api/v1/auth/guest` → returns `access_token` (no auth header).
- **Authenticated requests:** `Authorization: Bearer <access_token>`.
- **Current user:** `GET /api/v1/auth/me`.

### API endpoints (all under `/api/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| POST | /auth/guest | No | Create guest user and token |
| GET | /auth/me | Yes | Current user profile |
| GET | /problems | No | List problems (topic, difficulty, type, search) |
| GET | /problems/{id} | No | Get one problem |
| POST | /sessions | Yes | Create session (`problem_id` optional — omit or null for blank whiteboard) |
| GET | /sessions | Yes | List sessions (sort: recent, name, topic); blank sessions included via LEFT JOIN |
| GET | /sessions/{id} | Yes | Get session with embedded problem (problem may be null for blank sessions) |
| PATCH | /sessions/{id} | Yes | Update session status and/or title |
| PUT | /sessions/{id}/snapshot | Yes | Save canvas snapshot (strokes_json, width, height) |
| GET | /sessions/{id}/snapshot | Yes | Get latest canvas snapshot for a session |
| POST | /analysis/steps | Yes | Analyze steps (session_id, optional snapshot_id) |
| POST | /chat | Yes | Send message (SSE stream) |
| GET | /chat/{session_id} | Yes | Chat history |

Step analysis and chat currently use stub implementations (no real OCR/SymPy/LLM). Seed problems via the API or by inserting directly into the `problems` table.

---

## Frontend setup

- **Install:** `cd frontend && pnpm install`
- **Dev:** `pnpm dev` → http://localhost:3000 (Next.js with Turbopack)
- **Build:** `pnpm build` then `pnpm start`
- **Lint:** `pnpm lint`

Next.js 15 App Router app with TypeScript, Tailwind CSS, Radix UI, and `sonner` for toasts.

---

## Whiteboard (session page)

The session whiteboard supports pen, highlighter, eraser, shapes (line, rectangle, circle, arrow), text, and images; selection (lasso/box), move, cut/copy/paste; undo/redo (including text and images); zoom toward cursor; and a grid overlay.

**Persistence:**
- All sessions (problem and blank) save canvas state to the backend via `PUT /api/v1/sessions/{id}/snapshot`. Autosave runs on a debounce after any stroke, shape, or text change. A final snapshot is also fired when the user clicks the Back button.
- On a server 500, work is backed up to `localStorage` as a fallback so nothing is lost.
- Legacy blank-board `localStorage` drafts are automatically migrated to the backend on first load.

**Blank whiteboards:**
- Created from the dashboard "New blank whiteboard" card (calls `POST /sessions` with `problem_id: null`).
- A blank session has no problem statement, difficulty, or topic. The title defaults to "Untitled Whiteboard" and is editable inline (Google Docs–style).
- The old `/session/blank` URL redirects to `/app`.

**Title editing:**
- Click the whiteboard title in the header to rename it. Press Enter or click away to save. The new name is persisted via `PATCH /sessions/{id}` and is reflected on the dashboard immediately when you navigate back.

**Images:** Draggable and resizable (bottom-right handle). Copy/cut/paste use **Ctrl+C / Ctrl+X / Ctrl+V** (in-memory clipboard; paste places content at view center). Shortcuts are disabled when focus is in an input or textarea.

---

## Remaining work

- **Real "Check my steps"** — Send canvas snapshot to the backend, call the analysis API, and show real step feedback (OCR/LaTeX + comparison) instead of mock data.
- **Real chat** — Wire chat to the backend (SSE streaming), load chat history from the API, and use a real LLM for tutor responses.
- **Loading and error handling** — Comprehensive loading states and user-facing errors (401, 404, 5xx) for all API calls; retry where appropriate.

---

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [FastAPI docs](https://fastapi.tiangolo.com/)
