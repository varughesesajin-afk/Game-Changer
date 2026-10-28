# Auth testing (Emergent Google Auth)
- Users have `user_id` (custom), sessions in `user_sessions` {user_id, session_token, expires_at}.
- Seeded tokens: see /app/memory/test_credentials.md (test_session_admin, test_session_player, test_session_free).
- API: curl -H "Authorization: Bearer test_session_player" $URL/api/auth/me
- Browser: context.addCookies([{name:"session_token", value:"test_session_player", domain:"<host>", path:"/", httpOnly:true, secure:true, sameSite:"None"}]) then goto app.
- Callback: app detects `#session_id=` via useLocation().hash, POSTs /api/auth/session, redirects to /profile.
