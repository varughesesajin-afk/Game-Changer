# Green Ocean Sporting Events — "Game on"

Mobile-first web app for community sports games and tournaments (all sports, currency OMR).
React + Vite (frontend) · FastAPI (backend) · MongoDB · Sign in with Google (direct Google OAuth, no third-party login service).

## How hosting works — admin approval, no payments

The old OMR 1 / month payment has been replaced by approvals from the site admin:

1. **Starting a community** — anyone signed in can submit one. It is `pending` (only the host and the admin can see it) until the admin approves it. Approval makes it public, schedules its first games and grants **30 days of Manage**.
2. **Managing a community** — Manage runs in 30-day periods. When a period is ending (or has ended) the host taps *Request another 30 days* and the admin approves, declines or switches it off from the dashboard. While Manage is locked the host can't edit details, schedule games, remove members, upload photos or host tournaments.
3. **Hosting tournaments** — every community tournament is created `pending` and must be approved by the admin before it is public, takes team registrations or can be started.

The admin (emails listed in `ADMIN_EMAILS`) reviews everything in **/admin → Approvals**, and can also give +30 days or switch Manage off from the Communities tab. Admins' own communities and tournaments are approved automatically.

## Project layout

```
backend/    FastAPI app (server.py, routers/, lib/, models/), seed.py (demo data), tests/
frontend/   React + Vite + Tailwind app
docs/SPEC.md   Feature spec and business rules
Dockerfile, render.yaml   One-container deploy (builds the frontend, FastAPI serves it)
```

## Run locally

Requires Python 3.12+, Node 22+, and a MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# backend
cd backend
cp .env.example .env        # set MONGO_URL, DB_NAME, ADMIN_EMAILS
pip install -r requirements.txt
uvicorn server:app --port 8001 --reload

# frontend (new terminal) — Vite proxies /api to :8001
cd frontend
yarn install
yarn dev                    # http://localhost:3000
```

Optional demo data (**wipes communities/games/tournaments — use a throwaway database only**):

```bash
cd backend && ALLOW_SEED=1 python seed.py
```

## Deploy on Render (from this GitHub repo)

1. Create a free MongoDB Atlas cluster. Under *Network Access* allow `0.0.0.0/0` (Render's free tier has no fixed IP). Copy the connection string.
2. In Render: **New → Web Service**, pick this repo, set **Runtime: Docker**. (Or use **New → Blueprint** to read `render.yaml`.)
3. Add environment variables: `MONGO_URL` (the Atlas string), `DB_NAME` (e.g. `green_ocean`), `ADMIN_EMAILS` (your Google email), `APP_TZ` = `Asia/Muscat`, `APP_BASE_URL` (the service's public address, e.g. `https://green-ocean-sports.onrender.com`, no trailing slash), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (next section).
4. Deploy. Open the site, tap *Sign in*, and sign in with an `ADMIN_EMAILS` account — that account becomes the site admin and sees the Approvals dashboard at `/admin`.

### Set up Sign in with Google

1. In the [Google Cloud Console](https://console.cloud.google.com/) create a project (or reuse one) and open **APIs & Services → OAuth consent screen**. External is fine; add your own email as a test user while it's unpublished (or publish it so anyone can sign in).
2. **Credentials → Create Credentials → OAuth client ID → Web application.**
3. Under **Authorized redirect URIs** add `<APP_BASE_URL>/api/auth/google/callback` — for example `https://green-ocean-sports.onrender.com/api/auth/google/callback`. For local development also add `http://localhost:3000/api/auth/google/callback`.
4. Copy the **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Until those are set the Sign in button shows a short "not set up yet" message; the rest of the site still works.

## Tests

`backend/tests/` run against a live backend on a seeded throwaway database:

```bash
cd backend && ALLOW_SEED=1 python seed.py
uvicorn server:app --port 8001 &
pip install -r requirements-dev.txt
pytest tests/test_approval_flow.py -n 0
```
