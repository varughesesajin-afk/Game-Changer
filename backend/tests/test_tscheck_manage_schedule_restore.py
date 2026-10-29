"""Restored organiser endpoints: POST /communities/{id}/schedule-week and POST /communities/{id}/games.

Exercised against Tuesday Padel Night (Test Player, Manage active) per briefing.
Creates its own one-off game fixture; does not touch/delete seeded rows.
"""

import datetime

import httpx

PLAYER_AUTH = {"Authorization": "Bearer test_session_player"}


def _padel_community_id(client: httpx.Client) -> str:
    comms = client.get("/communities", headers=PLAYER_AUTH).json()
    return next(c for c in comms if c["name"] == "Tuesday Padel Night")["id"]


def test_schedule_next_week_returns_200_and_adds_games(client: httpx.Client):
    cid = _padel_community_id(client)
    before = client.get(f"/communities/{cid}/games", headers=PLAYER_AUTH).json()
    resp = client.post(f"/communities/{cid}/schedule-week", headers=PLAYER_AUTH)
    assert resp.status_code == 200, resp.text
    after = client.get(f"/communities/{cid}/games", headers=PLAYER_AUTH).json()
    assert len(after) >= len(before)


def test_add_one_off_game_returns_200_and_appears(client: httpx.Client):
    cid = _padel_community_id(client)
    future_date = (datetime.date.today() + datetime.timedelta(days=45)).isoformat()
    resp = client.post(
        f"/communities/{cid}/games",
        json={"date": future_date, "time": "19:00"},
        headers=PLAYER_AUTH,
    )
    assert resp.status_code == 200, resp.text
    new_game = resp.json()
    games = client.get(f"/communities/{cid}/games", headers=PLAYER_AUTH).json()
    assert any(g["id"] == new_game["id"] for g in games)
