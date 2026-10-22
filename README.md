# Sports Event Manager

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
- **Scheduling** — set date/time and venue per match.
- **Simple admin auth** — one organizer password protects the dashboard.

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

## How data is stored

All data lives in `data/db.json`, created automatically on first run.
There's no database server — back it up occasionally by copying that
file somewhere safe. This design supports exactly one running instance
(no shared storage across multiple servers).

## Deploying

Any host that runs a long-lived Node.js process works (Render, Railway,
Fly.io, a VPS). Start command: `node server.js`. Set `ADMIN_PASSWORD` as
an environment variable. If the host's filesystem is ephemeral (wiped on
redeploy), attach a persistent disk/volume and point it at the app's
`data/` folder so registrations and scores survive restarts.

## Project structure

```
server.js              Entry point
lib/                    Core logic (data store, fixture generation, standings)
routes/                 API routes (public + admin)
public/                 Frontend (HTML/CSS/JS)
data/db.json            All app data (created on first run)
```
