# Green Ocean Sporting Events ("Game on") — SPEC
Branding: blue→green gradient (bg-brand / text-brand utilities in index.css).

Mobile-first web app (max-w-md frame, bottom nav) for community sports games + tournaments, all sports. Currency OMR.

## Auth
- Direct Google OAuth (GET /api/auth/google/login → Google → GET /api/auth/google/callback; env GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL). WhatsApp OTP deferred. Cookie `session_token` (httpOnly, 30 days), Bearer header fallback.
- `varughesesajin@gmail.com` (env ADMIN_EMAILS) => role `admin` on login.
- Browsing is public; actions (join game, request a community, register team) require login.

## Data model (Mongo, string ids)
- users {user_id, email, name, picture, role, is_pro, pro_plan, pro_until}
- user_sessions {user_id, session_token, expires_at}
- communities {id, name, sport, city, venue, description, days[Mon..Sun], time, max_players, fee, owner_id, owner_name, members[], approval_status pending|approved|declined, manage_until, manage_requested_at}
- games {id, community_id, date YYYY-MM-DD, time, max_players, fee, roster[{id,user_id|null,name,team A|B,added_by}]}
  - creating a community auto-creates next occurrence for each weekday; "schedule-week" adds following week.
- tournaments {id, title, sport, kind official|community, community_id, status registration|ongoing|completed, approval_status pending|approved|declined, teams[], matches[] (single-elim bracket, byes auto-advance), champion_id}

## Business rules
- One host (owner) per community. ADMIN APPROVAL REPLACES PAYMENT: (1) a new community is created `pending` and is visible only to its host and the admin; the admin approves it (goes live, first games are scheduled, 30 days of Manage granted via communities.manage_until) or declines it. (2) Manage runs in 30-day periods: the host asks for another period (POST /api/communities/{cid}/manage-request) and the admin approves (POST /api/admin/communities/{cid}/manage/approve, +30 days from today or from the end of the running period), declines or revokes it. (3) Every community tournament is created `pending` and needs the admin's approval (POST /api/admin/tournaments/{tid}/approve|decline) before it is public, takes registrations or can be started. Admins' own communities/tournaments are approved at once.
- "Manage" button on community page (owner/admin). Owner needs manage_active (approved community and manage_until not yet passed) — else 403. Tournaments and gallery uploads need the same plus per-tournament approval. Admin manages everything.
- Manage unlocks: PATCH community details, schedule games (schedule-week / one-off), host community tournaments, remove members (DELETE /communities/{id}/members/{uid}) and other people's roster names, match-fee tracking (POST /games/{gid}/roster/{eid}/paid).
- Official tournaments: admin only. Admin dashboard /admin (GET /api/admin/overview: stats, users, communities, approval queues pending_communities / manage_requests / pending_tournaments).
- Organiser (or admin) starts tournament (>=2 teams) => bracket; reports scores (no draws) => winner advances; final => completed.
- Team captain (or organiser) adds players.
- No payments: the old Thawani Pay billing (OMR 1 / 30 days, 15-day trial) was removed and replaced by the admin approvals above.

## Endpoints (all /api)
auth/google/login, auth/google/callback, auth/me, auth/logout; feed; communities (CRUD, join, leave, games, schedule-week); games/mine, games/{id}/join|leave|guests, games/{id}/roster/{entry}; tournaments (list/create/get/delete, teams, players, start, matches/{mid}/result); communities/{cid}/manage-request; admin/overview, admin/communities/{cid}/approve|decline, admin/communities/{cid}/manage/approve|decline|revoke, admin/tournaments/{tid}/approve|decline.

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

## Community cover photos
- POST /api/images {data_url} (auth; jpeg/png/webp, <=2MB; client resizes to max 1600px JPEG) → {id, url:"/api/images/<id>"}; GET /api/images/{id} serves bytes (stored in Mongo `images`).
- community.image holds that URL; set on /communities/new (CoverPhotoPicker) or Manage → Details (PATCH image; "" resets to sport default).

## Flexible game scheduling (Manage → Games)
- "Schedule a game": POST /api/communities/{cid}/games {date, time?, venue?} (manage-gated; 409 if a game already exists on that date).
- Move a game: PATCH /api/games/{gid} {date?, time?, venue?} (roster kept, reminders updated; 409 on date clash). Cancel: DELETE /api/games/{gid} (also clears its reminders).
- Toasts render top-center so they never cover bottom-sheet actions.

## Membership approval, open/private, gallery, profile pictures
- Joining a community = request (community.join_requests); host (owner) or admin approves/declines: POST /api/communities/{cid}/requests/{uid}/approve|decline. Leave also withdraws a pending request. Joining a game no longer auto-adds membership.
- community.visibility open|private (set on create / Manage → Details). Private: only approved members (or host/admin) can join games or add guest names (403 otherwise); UI disables join with a note.
- Gallery (below Members, heading GALLERY): GET/POST /api/communities/{cid}/gallery (host/admin only to add; uses /api/images upload), DELETE /api/gallery/{id}. Full-screen viewer.
- Profile picture: PUT /api/auth/me/picture {picture} (null resets); users.picture_custom stops Google login overwriting it; propagated to members, join_requests and roster entries (RosterEntry.picture). Leaderboard rows resolve current user pictures.
- Seed: Tuesday Padel Night is PRIVATE with a pending request from Free Player.

## Tournament formats, Standings, Fixtures
- Tournament.format: league | knockout | groups_knockout | league_playoffs | other; league_legs (1 or 2 = home & away), group_count, advance_per_group, playoff_teams, format_notes (required >=10 chars for "other").
- Match.stage league|group|knockout (+ group letter; round = matchday for league/group). Start generates: knockout bracket; round-robin league (circle method); snake-drafted groups round-robin; "other" = no fixtures (listed in admin dashboard Formats tab for review).
- League/group results allow draws; when the stage is fully played: league → champion = table leader; groups → top N per group seeded into bracket (A1 v B2…); league_playoffs → top playoff_teams into bracket.
- GET /api/tournaments/{tid}/standings → [{group, rows: P W D L GF GA GD Pts}] (3/1/0; sort pts, GD, GF).
- Tournament page tabs: Teams | Standings | Fixtures (Fixtures = matchdays + knockout bracket). Seed: "Winter Futsal League" (official, groups + knockout, part-played).

## Tournament match centre, scorers, team badges, profile stats
- Match: date, time, pitch, goals[{team_id, player, goals}], motm_team_id/motm_player. PATCH /api/tournaments/{tid}/matches/{mid}/schedule; POST .../matches/{mid}/stats (organiser/admin; players must be from the two teams). GET /api/tournaments/{tid}/scorers → top scorers (goals, motm).
- Team.logo: PUT /api/tournaments/{tid}/teams/{team_id}/logo (captain/organiser; /api/images upload). Badges in Teams, Standings, Fixtures, Match centre.
- MatchDialog (match centre) opens from Fixtures and Bracket for everyone (read-only for non-organisers).
- Profile: MyStats tiles (Matches, Wins, Goals, MOTM) from GET /api/players/{user_id} (community games; tournament players are names, not accounts).

- Tournaments: entry fee and prize pool removed from the UI (fields remain in the model, default 0).

## Match sheet (tournament fixtures + community games)
- Host/organiser/admin only edits; everyone else sees a read-only summary (scorers with assists, MOTM, late per team).
- Tournament: POST /api/tournaments/{tid}/matches/{mid}/sheet MatchSheetIn {events:[{team_id, scorer|null, assist|null}], late:{team_id:[names]}, paid:{team_id:[names]}, motm_team_id, motm_player}. Players must be in that team's squad; assist != scorer. Goal count per team sets the score (applies result + bracket advance if not yet recorded; if already recorded the goals must add up to it, else 400). Match.goals (totals) is derived for the top-scorer table.
- Community game: POST /api/games/{gid}/sheet GameSheetIn {events:[{team A|B, scorer_id|null, assist_id|null}], late_ids, paid_ids, motm_entry_id}. Played games only. Sets result (winner from goal counts, events), roster goals/late/paid; clears reminders for newly paid.
- scorer null = "Unassigned goal" (own goals). Old results load as events without assists.
- UI: components/MatchSheet.tsx (shared), MatchDialog (fixtures), GameResultForm/GameSheetDialog (host Results tab), RecentResults on community page.

## Unpaid players list + jersey colours
- GET /api/communities/{cid}/unpaid (manage only) → UnpaidGame[] {game_id,date,time,fee,players:[{entry_id,name,user_id|null,reminded}]} for all games with fee>0 and unpaid roster entries (played + upcoming).
- POST /api/games/{gid}/roster/{entry_id}/remind (single; 400 for guests/paid), POST /api/communities/{cid}/remind-all-unpaid → RemindResult. UI: UnpaidList at top of Manage → Fees.
- Jerseys: Game.jersey_a/jersey_b and tournament Match.jersey_a/jersey_b (palette: White, Black, Red, Blue, Navy, Sky, Green, Yellow, Orange, Purple, Maroon, Grey; null = none). Set via GameCreate/GameUpdate (PATCH /games/{gid} always writes both) and MatchScheduleIn. Shown on GameCard team headers, scheduler list, and match dialog.
