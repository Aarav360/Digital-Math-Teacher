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
   npm install
   npm run dev
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
| POST | /sessions | Yes | Create session (body: problem_id) |
| GET | /sessions | Yes | List sessions (sort: recent, name, topic) |
| GET | /sessions/{id} | Yes | Get session with problem |
| PATCH | /sessions/{id} | Yes | Update session (e.g. status) |
| POST | /canvas/snapshot | Yes | Upload snapshot (session_id, strokes, width, height) |
| POST | /analysis/steps | Yes | Analyze steps (session_id, optional snapshot_id) |
| POST | /chat | Yes | Send message (SSE stream) |
| GET | /chat/{session_id} | Yes | Chat history |

Step analysis and chat currently use stub implementations (no real OCR/SymPy/LLM). Seed data: create problems via the API or a script that inserts into the `problems` table.

---

## Frontend setup

- **Install:** `cd frontend && npm install`
- **Dev:** `npm run dev` → http://localhost:3000 (Next.js with Turbopack)
- **Build:** `npm run build` then `npm start`
- **Lint:** `npm run lint`

Next.js app with TypeScript, Tailwind CSS, Radix UI, and the App Router. Start editing `app/page.tsx` (or your main page under `src/`) to change the UI.

---

## Whiteboard (session page)

The session whiteboard supports pen, highlighter, eraser, shapes, text, and images; selection (lasso/box), move, cut/copy/paste; undo/redo (including text and images); zoom toward cursor; and persistence to **localStorage** (keyed by session/problem id). Images are **draggable** and **resizable** (bottom-right handle). Copy/cut/paste use **Ctrl+C / Ctrl+X / Ctrl+V** (in-memory clipboard; paste places content at view center). Shortcuts are disabled when focus is in an input or textarea.

---

## Future steps (when backend/model is ready)

- **Real “Check my steps”** – Send canvas snapshot to the backend, call the analysis API, and show real step feedback (OCR/LaTeX + comparison) instead of mock data.
- **Real chat** – Wire chat to the backend (SSE streaming), load chat history from the API, and use a real LLM for tutor responses.
- **Session id in the flow** – Create/load a backend session when starting a problem; use `session_id` for snapshot upload, analysis, and chat; optionally use session id in the URL.
- **Backend persistence** – Optionally save/load whiteboard state from the API (e.g. `POST /canvas/snapshot` and load latest on session open) so content survives devices and browsers.
- **Loading and error handling** – Loading states and user-facing errors (401, 404, 5xx) for all API calls; retry where appropriate.

---

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [FastAPI docs](https://fastapi.tiangolo.com/)
