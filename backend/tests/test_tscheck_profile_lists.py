"""Profile lists: GET /api/communities?mine=true and GET /api/tournaments?mine=true.

Confirms Test Player's communities (host badge candidate: Tuesday Padel Night)
and tournaments (organiser badge candidate: Padel Night Americano) are returned.
"""

import httpx

PLAYER_AUTH = {"Authorization": "Bearer test_session_player"}


def test_communities_mine_includes_owned_and_joined(client: httpx.Client):
    resp = client.get("/communities", params={"mine": "true"}, headers=PLAYER_AUTH)
    assert resp.status_code == 200, resp.text
    comms = resp.json()
    names = {c["name"] for c in comms}
    assert "Tuesday Padel Night" in names, f"missing owned community, got {names}"
    padel = next(c for c in comms if c["name"] == "Tuesday Padel Night")
    assert padel["owner_id"] == "user_test_player"


def test_tournaments_mine_includes_organised(client: httpx.Client):
    resp = client.get("/tournaments", params={"mine": "true"}, headers=PLAYER_AUTH)
    assert resp.status_code == 200, resp.text
    tours = resp.json()
    titles = {t["title"] for t in tours}
    assert "Padel Night Americano" in titles, f"missing organised tournament, got {titles}"
    t = next(t for t in tours if t["title"] == "Padel Night Americano")
    assert t["organiser_id"] == "user_test_player"
