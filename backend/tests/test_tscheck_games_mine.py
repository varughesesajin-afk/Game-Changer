"""GET /api/games/mine — regression check (was 404, now restored).

Verifies the endpoint returns 200 and, after the test player joins a game,
that game appears in the response.
"""

import httpx

PLAYER_AUTH = {"Authorization": "Bearer test_session_player"}


def test_games_mine_returns_200(client: httpx.Client):
    resp = client.get("/games/mine", headers=PLAYER_AUTH)
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)


def test_games_mine_includes_joined_game(client: httpx.Client):
    # Find a community with upcoming games (not Tuesday Padel Night, to avoid
    # touching seeded Manage data) and join one of its games as Test Player.
    comms = client.get("/communities", headers=PLAYER_AUTH).json()
    target = next(c for c in comms if c["name"] == "Friday Hoops Run")
    games = client.get(f"/communities/{target['id']}/games", headers=PLAYER_AUTH).json()
    assert games, "expected at least one upcoming game for Friday Hoops Run"
    game = games[0]

    join_resp = client.post(f"/games/{game['id']}/join", json={"team": "A"}, headers=PLAYER_AUTH)
    assert join_resp.status_code == 200, join_resp.text

    try:
        mine = client.get("/games/mine", headers=PLAYER_AUTH).json()
        assert any(g["id"] == game["id"] for g in mine), "joined game missing from /games/mine"
    finally:
        client.post(f"/games/{game['id']}/leave", headers=PLAYER_AUTH)
