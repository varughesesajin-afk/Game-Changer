# Games All Day

A self-hosted app for organizing sports events: a public page where teams
or players register themselves, and an organizer dashboard to generate
fixtures, run the schedule, and record scores.

It has **zero external dependencies** — no `npm install` step, no
database server to set up. It's plain Node.js, a small built-in JSON
data store, and static HTML/CSS/JS.

## Features

- **Multiple events** — run more than one tournament/league over time.
- **Public registration** — a shareable link where teams (or individual players) register themselves with contact details.
- **Smart fixture suggestions** — Round Robin, Single Elimination Knockout, or Groups + Knockout, based on headcount and sport, with a plain-English reason.
- **Automatic bracket generation** — round robin scheduling, knockout brackets with byes handled automatically, and group stages that promote top finishers into a knockout bracket.
- **Live scores & standings** — organizers enter scores; the public site shows an up-to-date league table or bracket automatically.
- **Visual knockout bracket** — a connected bracket tree (not just a list) on both the public page and the admin dashboard.
- **Goals, assists & Player of the Match** — log who scored, who assisted, and tag a standout player per match; tallied into event-wide leaderboards.
- **Player rating cards** — a quick, transparent OVR rating per player for this event, computed from goals/assists/POTM (team sports) or match record (individual sports).
- **Format summary card** — a plain-English read-only overview of the sport, format, and qualification rules on the public event page.
- **Match Days** — casual games or training sessions (separate from tournament events): the organizer sets a venue, date, time and a player cap (e.g. 12/16/18), and players just add their own name to the list until it's full. No team registration needed.
- **Communities** — clubs/groups anyone signed in can start and host themselves ("+ Start one"), each with its own member list and slot-based games (tap an open Team A/B spot to claim it, see entry fee per spot). A community's host can edit its details, open/close it, and add or remove games right from the community page — no admin password needed. The site admin can also manage (or take over) any community from the dashboard.
- **Sign in with Google** — players sign in with their Google account (no passwords to manage) to join communities and claim game slots. Each signed-in player gets a My Games tab showing the communities they've joined and the games they're in.
- **Tourneys, Host & Earn** — a combined view of official tournaments and competitive community games (Tourneys), and a display-only earnings calculator and pricing preview for hosts (Host & Earn) — no real payments are processed.
- **Scheduling** — set date/time and venue per match.
- **Simple admin auth** — one organizer password protects the dashboard. There's no separate "Organizer" tab in the main navigation — the dashboard is reached via the footer's "Organizer login" link, and the admin sees a contextual "Manage" link on events/match days/communities they're logged in to administer.

## Running it locally

Requires only Node.js 18+ — nothing else to install.

```bash
node server.js
```

Open **http://localhost:3000** for the public site, and
**http://localhost:3000/admin.html** to manage events.

The default admin password is `admin123`. Change it with:

```bash
ADMIN_PASSWORD="something-only-you-know" node server.js
```

### Setting up Sign in with Google

Joining a community or claiming a game slot requires Google sign-in. Until
you set it up, the rest of the site works fine — the "Continue with Google"
buttons just explain it isn't configured yet.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create
   a project (or use an existing one), then go to
   **APIs & Services → OAuth consent screen** and set it up (External user
   type is fine; add your own email as a test user while it's unpublished).
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**, type **Web application**.
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/google/callback` (for running it locally)
   - `https://<your-render-url>/api/auth/google/callback` (your live site)
4. Copy the **Client ID** and **Client Secret** it gives you, and set them
   as environment variables:

```bash
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
APP_BASE_URL="https://<your-render-url>" \
node server.js
```

`APP_BASE_URL` should be the exact public URL of your deployed site (no
trailing slash) — it's used to build the redirect URI. Locally you can
leave it unset; it defaults to `http://localhost:<PORT>`.

## How data is stored

All data lives in `data/db.json`, created automatically on first run.
There's no database server — back it up occasionally by copying that
file somewhere safe. This design supports exactly one running instance
(no shared storage across multiple servers).

## Deploying

Any host that runs a long-lived Node.js process works (Render, Railway,
Fly.io, a VPS). Start command: `node server.js`. Set `ADMIN_PASSWORD` as
an environment variable, and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
`APP_BASE_URL` if you want Sign in with Google (see above). If the host's
filesystem is ephemeral (wiped on redeploy), attach a persistent disk/volume
and point it at the app's `data/` folder so registrations and scores
survive restarts.

## Project structure

```
server.js              Entry point
lib/                    Core logic (data store, fixture generation, standings)
routes/                 API routes (public + admin)
public/                 Frontend (HTML/CSS/JS)
data/db.json            All app data (created on first run)
```
