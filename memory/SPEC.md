# PlayHub — SPEC

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
- Free users: max 1 owned community (402 otherwise). Pro/admin: unlimited.
- Community tournaments: Pro or admin, must own the community. Official tournaments: admin only.
- Organiser (or admin) starts tournament (>=2 teams) => bracket; reports scores (no draws) => winner advances; final => completed.
- Team captain (or organiser) adds players.
- Organiser Pro: 5 OMR/month or 50 OMR/year — PAYMENTS ARE MOCKED (POST /api/billing/subscribe flips is_pro immediately). Stripe sandbox unavailable in Oman.

## Endpoints (all /api)
auth/session, auth/me, auth/logout; feed; communities (CRUD, join, leave, games, schedule-week); games/mine, games/{id}/join|leave|guests, games/{id}/roster/{entry}; tournaments (list/create/get/delete, teams, players, start, matches/{mid}/result); billing/plans|subscribe|cancel|history.

## Seed (cd backend && python seed.py)
5 communities (Sunday Champions 7v7 Sun/Tue owned by admin, Tuesday Padel Night & Friday Hoops Run owned by Test Player, Beach Volley Crew, Weekend Tape-Ball Cricket), 4 official tournaments, 2 community tournaments (Sunday Champions Mini League ongoing with bracket; Padel Night Americano in registration organised by Test Player).
