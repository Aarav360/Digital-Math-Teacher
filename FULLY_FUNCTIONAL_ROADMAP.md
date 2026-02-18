# Digital Math Teacher — Roadmap to Fully Functional

This document expands on the seven areas that need work for the app to be fully functional (excluding whiteboard/canvas behavior). **Delete this file once work is done or the plan is moved elsewhere.**

---

## 1. Frontend–backend integration

The UI is built but uses only local mock data and in-memory simulations. No API client exists and no requests are sent to the backend.

### 1.1 Auth flow

**Current state:** The auth page (`frontend/src/app/auth/page.tsx`) shows “Sign in with Google” and “Try without signing in.” Both are `<Link href="/app">` — they just navigate. No token is created or stored; no `Authorization` header is ever sent.

**What’s needed:**

- **Guest path:** When the user chooses “Try without signing in” (or lands on `/app` without a token), call `POST /api/v1/auth/guest`. The backend returns `{ access_token, token_type: "bearer", user_id }`. Store the token (e.g. in memory, `localStorage`, or a cookie) and optionally the `user_id`.
- **Sending the token:** Every request that requires auth (sessions, canvas snapshot, analysis, chat) must include the header: `Authorization: Bearer <access_token>`.
- **Token persistence:** Decide where to store the token so it survives refresh (e.g. `localStorage`) and whether to refresh or re-guest on expiry. If using localStorage, consider a simple auth context or hook that reads the token and attaches it to a shared `fetch` wrapper.
- **“Current user”:** Optionally call `GET /api/v1/auth/me` on app load to validate the token and get user info; redirect to auth or re-guest if 401.

**Files to touch:** Auth page (or a wrapper that runs before `/app`), a new API client or `fetch` helper, and any layout or provider that holds auth state.

### 1.2 Problems from the API

**Current state:** The problems list (`frontend/src/app/(app)/problems/page.tsx`) filters and displays the hardcoded `PROBLEMS` array from `frontend/src/lib/data.ts`. The backend exposes `GET /api/v1/problems` (with query params: `topic`, `difficulty`, `type`, `search`) and `GET /api/v1/problems/{id}`.

**What’s needed:**

- **API base URL:** Use `process.env.NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000`) for all backend calls. Document in README or `.env.local.example` (already present).
- **Fetch problems list:** On load (or when filters change), call `GET /api/v1/problems?topic=...&difficulty=...&type=...&search=...`. Map the response to the shape the UI expects (id, title, topic, difficulty, type, estimatedTime, statement). Handle loading and empty state.
- **Fetch one problem:** When opening a session or problem detail, call `GET /api/v1/problems/{id}` if you need full problem data from the backend. Ensure IDs from the API are used consistently (e.g. when linking to a session).
- **Remove or phase out:** Stop importing and using the static `PROBLEMS` array for the problems list once the API is wired. You can keep it as fallback or delete it.

**Files to touch:** `problems/page.tsx`, a shared API client or hooks (e.g. `useProblems`, `getProblem(id)`), and possibly `lib/data.ts` (remove or shrink `PROBLEMS`).

### 1.3 Sessions: create and list

**Current state:** The dashboard (`frontend/src/app/(app)/app/page.tsx`) uses the hardcoded `SESSIONS` array from `lib/data.ts`. Clicking a problem in the problems list goes to `/session/${problem.id}` — i.e. the **problem** id is in the URL, not a backend **session** id. The backend never receives a create-session or list-sessions request.

**What’s needed:**

- **Create session:** When the user starts a problem (e.g. clicks “Start” or opens a problem for the first time), call `POST /api/v1/sessions` with body `{ problem_id: "<problem_id>" }` and the auth header. The response includes the new session (e.g. `id`, `problem_id`, `status`). Then either:
  - Navigate to `/session/<session_id>` and load session + problem by session id, or
  - Keep a URL like `/session/problem/<problem_id>` but create a session in the background and store `session_id` in state/context so all subsequent calls (snapshot, analysis, chat) use that session.
- **List sessions:** The dashboard should call `GET /api/v1/sessions` (with optional `sort`, `limit`, `offset`) and display the returned list (id, problem title, topic, status, steps correct/total, last activity). Map the API response to the UI’s session type.
- **Get one session:** When opening a session page, call `GET /api/v1/sessions/{session_id}` to get session and embedded problem. Ensure the session belongs to the current user (backend already enforces this).

**Files to touch:** Dashboard page, problems page (where “Start” triggers navigation), session page (read session id from URL or context, load session + problem from API), and a shared API module for sessions.

### 1.4 Step analysis (real backend call)

**Current state:** On the session page, “Check my steps” runs a local simulation: a few “Reading your steps…”-style messages and then sets feedback to `MOCK_FEEDBACK` from `lib/data.ts`. No snapshot is sent to the backend; no call to the analysis endpoint.

**What’s needed:**

- **Send snapshot:** Before or as part of analysis, the frontend must send the current canvas state to the backend. The backend already has `POST /api/v1/canvas/snapshot` (body: `session_id`, `strokes`, `width`, `height`). So: when the user clicks “Check my steps,” first POST the current strokes (and dimensions) as a snapshot for the current `session_id`, then call the analysis endpoint.
- **Call analysis:** Call `POST /api/v1/analysis/steps` with body `{ session_id, snapshot_id? }`. If you just uploaded a snapshot, you can use the returned snapshot id or omit it and let the backend use the latest. The response includes `steps` (each with `latex_raw`, `evaluation` with `status`, `verdict`, `explanation`, `suggestion`) and a `summary`.
- **UI:** Replace the local delay + `MOCK_FEEDBACK` with: (1) show loading state while the request is in flight, (2) display the returned steps and evaluations in the Feedback tab (same or similar UI as now). Handle errors (e.g. no snapshot, 404 session).

**Files to touch:** Session page (handleCheckSteps: upload snapshot then POST analysis, then set state from response), and possibly a small API helper for canvas and analysis.

### 1.5 Chat (SSE and history)

**Current state:** Sending a message in the session page uses a local simulation: append user message, `setTimeout(1500)`, then append a hardcoded assistant message. No backend call.

**What’s needed:**

- **Send message (streaming):** When the user sends a message, call `POST /api/v1/chat` with body `{ session_id, message, include_steps? }` and auth header. The response is Server-Sent Events (SSE): events with `type: 'token'` and `content` (chunk of text), then `type: 'done'`. Use `EventSource` or `fetch` with `ReadableStream` to consume the stream; append token chunks to the assistant message in the UI, then mark the message complete when `done` is received.
- **Persist assistant message:** The backend already persists both user and assistant messages. After the stream finishes, you can either refetch history or append the full assistant message on the client from the concatenated chunks.
- **Chat history:** On opening the session (or the Chat tab), call `GET /api/v1/chat/{session_id}` to load existing messages. Display them in the same format (user/assistant, content, optional timestamp). Replace the initial mock `chatMessages` state with the API response.

**Files to touch:** Session page (handleSendChat: call POST /chat, stream response, update UI; load history from GET /chat/{session_id} on mount or when opening chat), and an API helper for chat (e.g. `sendChatMessage(sessionId, message)`, `getChatHistory(sessionId)`).

### 1.6 Shared API client and errors

**What’s needed:**

- **Single place for base URL and auth:** Create a small API client (e.g. `frontend/src/lib/api.ts` or `api/client.ts`) that uses `NEXT_PUBLIC_API_URL`, reads the stored token, and sets `Authorization: Bearer <token>` on every request. Expose methods like `getProblems(params)`, `getProblem(id)`, `createSession(problemId)`, `getSessions(params)`, `getSession(id)`, `uploadSnapshot(sessionId, ...)`, `analyzeSteps(sessionId, snapshotId?)`, `getChatHistory(sessionId)`, `sendChatMessage(sessionId, message)` (returning a stream or a promise that resolves when stream is done).
- **Error handling:** On 401, clear token and redirect to auth (or auto-guest). On 404/5xx, show a user-friendly message or toast. For analysis and chat, handle network errors and timeouts so the UI doesn’t hang.
- **Loading states:** Use loading flags or suspense so lists (problems, sessions), session detail, analysis, and chat all show a loading state while fetching.

---

## 2. Backend seed data for problems

**Current state:** The backend has a `problems` table and `GET /api/v1/problems` (and `GET /api/v1/problems/{id}`), but there is no seed script or migration that inserts rows. A fresh database returns an empty list.

**What’s needed:**

- **Seed script or migration:** Add a way to insert a minimal set of problems so the API returns data. Options:
  - **Alembic migration:** A data migration that inserts e.g. the same problems as in the old frontend `PROBLEMS` array (id, title, topic, difficulty, type, estimated_time, statement, solution_canonical). Run once with `alembic upgrade head`.
  - **Standalone script:** A script (e.g. `backend/scripts/seed_problems.py`) that connects to the DB (using `DATABASE_URL` from env), creates the tables if needed (or assumes migrations are applied), and inserts the same set of problems. Run manually or in a “seed” make target.
- **Schema alignment:** Ensure seed data matches the `Problem` model (e.g. `id` as string, `solution_canonical` optional). If the frontend previously used numeric-looking ids like `"1"`, `"2"`, use the same so links and session creation stay consistent.
- **Documentation:** In the root README or backend section, add a one-liner: “Seed problems: run `alembic upgrade head` (if using a data migration) or `python scripts/seed_problems.py`.”

**Files to touch:** New migration file or new script under `backend/scripts/`, and README.

---

## 3. Step analysis pipeline (real implementation)

**Current state:** `backend/app/services/math_pipeline.py` implements `run_analysis(db, session, snapshot)`. It does not perform temporal grouping, OCR, or comparison. It creates one placeholder step (e.g. `latex_raw="2x = 8"`) and one evaluation (status “correct”, verdict “Correct”, explanation saying it’s a stub).

**What’s needed:**

- **Temporal grouping:** From the snapshot’s `strokes_json` (list of strokes with points and timestamps if available), group strokes into “steps” by pause duration (e.g. >1.5s between strokes). If timestamps are not stored, consider heuristics (e.g. spatial gaps, number of strokes) or add timestamp capture in the frontend when sending strokes.
- **Per-group LaTeX:** For each group of strokes, either:
  - **OCR:** Render strokes to an image (or use a canvas image if the frontend sends one) and run handwriting-to-LaTeX (e.g. external API or model), or
  - **LLM:** Send stroke data or a rasterized image to an LLM and ask for LaTeX. Store result in `Step.latex_raw` (and optionally in `stroke_group` as indices into the strokes array).
- **Compare to canonical solution:** The problem has `solution_canonical` (LaTeX or structured). Use SymPy (or similar) to parse both the student’s LaTeX and the canonical solution, normalize (e.g. simplify, expand), and compare. Decide correct/incorrect/warning and a short verdict.
- **LLM for explanation and suggestion:** Optionally call an LLM with: problem statement, canonical solution, student’s step LaTeX, and comparison result. Ask for a brief explanation and a suggestion. Store in `StepEvaluation.explanation` and `suggestion`.
- **Create records:** For each group, create one `Step` (session_id, snapshot_id, step_index, latex_raw, stroke_group) and one `StepEvaluation` (step_id, status, verdict, explanation, suggestion). Return the count of steps created.

**Dependencies:** The backend `requirements.txt` already has optional comments for `openai` and `sympy`. Add them when implementing. Consider where to run OCR (in-process vs external service) and rate limits/costs for LLM calls.

**Files to touch:** `app/services/math_pipeline.py` (and possibly a new module for OCR or SymPy comparison), `app/models/problem.py` (ensure `solution_canonical` is used), and `requirements.txt` if new deps are added.

---

## 4. Chat: real LLM streaming

**Current state:** The chat endpoint in `backend/app/api/v1/chat.py` uses an internal `_stream_stub` that persists the user message, yields one SSE event with a fixed stub string and a `done` event, then persists the stub as the assistant message. The function `stream_tutor_response` in `app/services/llm_chat.py` is not used and itself only yields a stub string.

**What’s needed:**

- **Wire the service:** In the chat endpoint, replace `_stream_stub` with a call to `stream_tutor_response(db, session, user_message, include_steps)`. Consume the async generator and yield SSE events (e.g. each chunk as `{ type: 'token', content: chunk }`, then `{ type: 'done' }`). After the stream completes, persist the full assistant message (e.g. by collecting chunks in the endpoint and calling `save_assistant_message`, or have the service do it).
- **Implement `stream_tutor_response`:**
  - Load the session with problem (and optionally steps and chat history). Build a system + user prompt that describes the problem, the student’s steps (if `include_steps`), and the conversation history.
  - Call an LLM with streaming (e.g. OpenAI `chat.completions.create(stream=True)`). Use a tutor persona if desired (e.g. from frontend or backend config).
  - Yield token chunks from the stream. Optionally buffer and call `save_assistant_message` at the end, or let the endpoint do it.
- **Configuration:** Add an env var for the LLM API key (e.g. `OPENAI_API_KEY`) and optionally model name. Document in `.env.example` and README. Handle missing key (e.g. return a friendly error or fall back to stub in development).

**Files to touch:** `app/api/v1/chat.py` (use `stream_tutor_response`, emit SSE, persist assistant message), `app/services/llm_chat.py` (full implementation with OpenAI or another provider), `app/core/config.py` (new settings), and `.env.example` / README.

---

## 5. Auth: “Sign in with Google”

**Current state:** The auth page shows a “Sign in with Google” button that only links to `/app`. There is no OAuth client or backend support for Google.

**What’s needed (if you want real Google sign-in):**

- **Backend:** Add an OAuth flow (e.g. OAuth 2.0 with Google). Endpoints might include: “Redirect to Google” (with client_id, redirect_uri, scope), and “Callback” (exchange code for tokens, fetch Google user info, find or create user in DB, issue your own JWT). Store users with something like `email`, `name`, `google_id`, and `is_guest=False`. Use the same JWT format as guest so the rest of the API stays unchanged.
- **Frontend:** “Sign in with Google” should redirect to the backend’s “Redirect to Google” URL (or a frontend route that redirects there). After Google redirects back to your callback, the backend sets a cookie or returns the JWT (e.g. redirect to `/app?token=...` or set an httpOnly cookie). Frontend then uses the same token for API calls.
- **If not implementing soon:** Remove the button, or replace with “Coming soon,” or make it a no-op and rely on guest only until OAuth is built.

**Files to touch:** Auth page, backend auth routes (and possibly a new `auth/google.py` or similar), user model (if new fields), and README/env for Google client id/secret.

---

## 6. Session vs problem in the URL and data model

**Current state:** The session page is at `/session/[id]`. The frontend treats this `id` as the **problem** id (from mock data) and looks up the problem in `PROBLEMS`. There is no backend session id in the flow; the backend design is “one session per user per problem attempt” with its own UUID.

**What’s needed:**

- **Decide URL and flow:** Two common options:
  - **Session id in URL:** When the user starts a problem, create a session via the API and navigate to `/session/<session_id>`. The session page loads session + problem via `GET /api/v1/sessions/<session_id>`. “New session” for the same problem means another `POST /sessions` and a new URL. Clean and consistent with the backend.
  - **Problem id in URL with session in state:** Keep something like `/session/problem/<problem_id>`. On enter, call “create or get latest session for this problem” (backend may need an endpoint like “GET or create session for user + problem”), then store `session_id` in React state or context and use it for snapshot/analysis/chat. List view still uses `GET /sessions` and can link to `/session/<session_id>` for “continue.”
- **Consistency:** Whatever you choose, ensure: (1) canvas snapshots are tied to the same `session_id` the backend expects, (2) analysis and chat use that `session_id`, and (3) the dashboard “My sessions” list comes from the API and links to the correct URL (session id or problem id + session in state).

**Files to touch:** Session page (route param and how you load session/problem), dashboard and problems pages (how “Start” / “Continue” link), and possibly a small “session context” or hook that holds current `session_id` and `problem` for the session page.

---

## 7. Error handling and loading states

**Current state:** The frontend does not show API errors or loading states for backend calls because no backend calls are made yet.

**What’s needed:**

- **Loading:** For every async operation that hits the API (problems list, sessions list, session detail, upload snapshot, analysis, chat send, chat history), show a loading indicator (skeleton, spinner, or disabled button) until the request completes. Avoid flashing empty content then filling it in if you can (e.g. keep previous data and show a small loading state for refresh).
- **Errors:** On `fetch` failure or non-2xx response:
  - **401:** Clear stored token, redirect to auth (or trigger guest flow again).
  - **404:** Show “Not found” (e.g. problem or session doesn’t exist or doesn’t belong to the user).
  - **4xx/5xx:** Show a short message or toast (“Something went wrong. Please try again.”) and optionally log or report. For analysis and chat, allow retry (e.g. “Check my steps” again, or “Send” again).
- **Validation:** If the backend returns validation errors (e.g. 422 with body details), you can show field-level errors if the form supports it; otherwise a generic “Invalid input” is enough to start.
- **Edge cases:** Empty problem list (no seed data), empty sessions list (new user), and “no snapshot to analyze” are already or can be returned by the backend; handle them in the UI with clear copy.

**Files to touch:** API client (central place to check response status and throw or return errors), each page or hook that calls the API (set loading/error state, render accordingly), and optionally a small error-boundary or toast provider for global errors.

---

## Summary checklist

| # | Area | Key actions |
|---|------|-------------|
| 1 | Frontend–backend integration | API client with auth header; wire auth (guest), problems, sessions, snapshot + analysis, chat (SSE + history); loading/error handling |
| 2 | Backend seed data | Seed script or migration to insert problems |
| 3 | Step analysis pipeline | Temporal grouping, OCR/LLM for LaTeX, SymPy compare, LLM for explanation; real Step + StepEvaluation records |
| 4 | Chat LLM | Use `stream_tutor_response`, implement with OpenAI (or other) streaming; persist assistant message; env for API key |
| 5 | Google sign-in | Implement OAuth (backend + frontend) or remove/disable button |
| 6 | Session vs problem URL | Decide session-id vs problem-id URL; create session on start; use same session_id for snapshot/analysis/chat |
| 7 | Errors and loading | Loading state per request; 401 → re-auth; 404/5xx → user message; retry where appropriate |

**Delete this file once the roadmap is no longer needed.**
