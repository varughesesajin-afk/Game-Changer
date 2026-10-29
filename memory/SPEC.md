# Green Ocean Sporting Events ("Game on") — SPEC
Branding: blue→green gradient (bg-brand / text-brand utilities in index.css).

Mobile-first web app (max-w-md frame, bottom nav) for community sports games + tournaments, all sports. Currency OMR.

## Auth
- Emergent-managed Google login only (WhatsApp OTP deferred by user). Cookie `session_token` (httpOnly), Bearer header fallback.
- `varughesesajin@gmail.com` (env ADMIN_EMAILS) => role `admin` on login.
- Browsing is public; actions (join game, create, register team, subscribe) require login.

## Data model (Mongo, string ids)
- users {user_id, email, name, picture, role, is_pro, pro_plan, pro_until}
- user_sessions {user_id, session_token, expires_at}
- communities {id, name, sport, city, venue, description, days[Mon..Sun], time, max_players, fee, owner_id, owner_name, members[]}
- games {id, community_id, date YYYY-MM-DD, time, max_players, fee, roster[{id,user_id|null,name,team A|B,added_by}]}
  - creating a community auto-creates next occurrence for each weekday; "schedule-week" adds following week.
- tournaments {id, title, sport, kind official|community, community_id, status registration|ongoing|completed, teams[], matches[] (single-elim bracket, byes auto-advance), champion_id}
- payment_transactions (MOCKED billing records)

## Business rules
- Each organiser (non-admin) can own exactly 1 community (409 otherwise).
- "Manage" button on community page (owner/admin). Owner must have an active per-community Manage subscription (OMR 1/month, communities.manage_until; manage_active computed on read) — else 402. Admin manages everything free.
- Manage unlocks: PATCH community details, schedule games (schedule-week / one-off), host community tournaments, remove members (DELETE /communities/{id}/members/{uid}) and other people's roster names, match-fee tracking (POST /games/{gid}/roster/{eid}/paid).
- Official tournaments: admin only. Admin dashboard /admin (GET /api/admin/overview: stats, users, communities, payments).
- Organiser (or admin) starts tournament (>=2 teams) => bracket; reports scores (no draws) => winner advances; final => completed.
- Team captain (or organiser) adds players.
- Billing — PAYMENTS ARE MOCKED: POST /api/billing/communities/{cid}/subscribe extends manage_until +30 days; /cancel clears it. Old Organiser Pro plans removed (user.is_pro unused).

## Endpoints (all /api)
auth/session, auth/me, auth/logout; feed; communities (CRUD, join, leave, games, schedule-week); games/mine, games/{id}/join|leave|guests, games/{id}/roster/{entry}; tournaments (list/create/get/delete, teams, players, start, matches/{mid}/result); billing/plans|subscribe|cancel|history.

## Seed (cd backend && python seed.py)
5 communities (Sunday Champions 7v7 Sun/Tue owned by admin, Tuesday Padel Night (Manage ACTIVE) owned by Test Player; Friday Hoops Run owned by admin, Beach Volley Crew, Weekend Tape-Ball Cricket), 4 official tournaments, 2 community tournaments (Sunday Champions Mini League ongoing with bracket; Padel Night Americano in registration organised by Test Player).

## In-app fee reminders
- Manage → Fees → "Remind unpaid" (POST /api/games/{gid}/remind-unpaid, manage-gated) upserts a `reminders` doc per unpaid signed-in player (guests skipped). Returns {reminded, skipped_guests}.
- Players see a banner at the top of every screen (GET /api/reminders/mine; only while still on roster & unpaid). Dismiss: POST /api/reminders/{id}/dismiss. Marking paid deletes the reminder. Nothing is emailed/sent.

## Results, leaderboards, game notices, sharing
- Game.result {winner A|B|draw, score_a, score_b}; RosterEntry.goals. POST /api/games/{gid}/result (manage-gated, only for date <= today) with goals map {entry_id: n}. Manage → Results tab lists played games (GET /communities/{cid}/games?past=true).
- GET /api/communities/{cid}/leaderboard → rows {name, user_id, games, wins, goals} over played games (result recorded or date < today); guests keyed by name. Shown on community page (Most games / Most wins / Top scorers).
- GET /api/games/mine/soon → games the user is on for today/tomorrow → in-app notice banner (dismiss stored in localStorage).
- WhatsApp share (wa.me link) + copy-link on community and tournament pages. Sign-in returns to the last visited page (sessionStorage returnTo).
- Seed adds 3 past games with results for the first 3 communities.

## Player profiles, Man of the Match, seasons
- GameResult.motm_entry_id (must be on roster). Leaderboard rows include motm; MOTM tab + star badge.
- Community.season_length manual|month|quarter, season_start (set by "Start new season now"). Effective season start = max(auto period start, season_start), server-anchored. POST /api/communities/{cid}/season {season_length, start_now} (manage-gated). GET leaderboard?scope=season|all returns {scope, season_label, season_start, rows}.
- GET /api/players/{key}[?community_id=] — key = user_id (aggregated across communities) or guest:<name> (requires community_id). Page /players/:key, opened by tapping a leaderboard row.
