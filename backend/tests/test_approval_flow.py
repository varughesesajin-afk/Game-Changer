"""Admin-approval flow (replaces the old OMR 1 payment). Runs against the live backend — seed a THROWAWAY database first:
    ALLOW_SEED=1 python seed.py      then      pytest tests/test_approval_flow.py -n 0
Uses the seeded test sessions: admin, Test Player (owns Tuesday Padel Night, Manage active) and Free Player."""
import uuid

import pytest

ADMIN = {"Authorization": "Bearer test_session_admin"}
PLAYER = {"Authorization": "Bearer test_session_player"}
FREE = {"Authorization": "Bearer test_session_free"}


def _ids(rows):
    return {r["id"] for r in rows}


@pytest.fixture
def new_community(client):
    r = client.post("/communities", json={"name": f"Approval Test {uuid.uuid4().hex[:6]}", "sport": "Football", "days": ["Mon"]}, headers=FREE)
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    client.delete(f"/communities/{c['id']}", headers=ADMIN)


def test_new_community_waits_for_approval(client, new_community):
    c = new_community
    assert c["approval_status"] == "pending" and c["manage_active"] is False
    # hidden from the public, visible to its host and the admin
    assert c["id"] not in _ids(client.get("/communities").json())
    assert client.get(f"/communities/{c['id']}").status_code == 404
    assert c["id"] in _ids(client.get("/communities", headers=FREE).json())
    assert client.get(f"/communities/{c['id']}", headers=FREE).status_code == 200
    # the host can't manage it yet
    assert client.patch(f"/communities/{c['id']}", json={"venue": "X"}, headers=FREE).status_code == 403
    # shows up in the admin queue
    overview = client.get("/admin/overview", headers=ADMIN).json()
    assert c["id"] in _ids(overview["pending_communities"])
    # non-admins cannot approve
    assert client.post(f"/admin/communities/{c['id']}/approve", headers=FREE).status_code == 403

    # admin approves: live, 30 days of Manage, first games scheduled
    ok = client.post(f"/admin/communities/{c['id']}/approve", headers=ADMIN).json()
    assert ok["approval_status"] == "approved" and ok["manage_active"] is True and ok["manage_until"]
    assert c["id"] in _ids(client.get("/communities").json())
    assert client.get(f"/communities/{c['id']}/games").json()
    assert client.patch(f"/communities/{c['id']}", json={"venue": "Turf 1"}, headers=FREE).status_code == 200


def test_manage_renewal_request(client, new_community):
    cid = new_community["id"]
    first = client.post(f"/admin/communities/{cid}/approve", headers=ADMIN).json()
    assert client.post(f"/communities/{cid}/manage-request", headers=PLAYER).status_code == 403  # not the host
    req = client.post(f"/communities/{cid}/manage-request", headers=FREE)
    assert req.status_code == 200 and req.json()["manage_requested_at"]
    assert client.post(f"/communities/{cid}/manage-request", headers=FREE).status_code == 409  # already asked
    assert cid in _ids(client.get("/admin/overview", headers=ADMIN).json()["manage_requests"])
    renewed = client.post(f"/admin/communities/{cid}/manage/approve", headers=ADMIN).json()
    assert renewed["manage_requested_at"] is None and renewed["manage_until"] > first["manage_until"]  # period extended by 30 days
    # admin can switch Manage off again
    revoked = client.post(f"/admin/communities/{cid}/manage/revoke", headers=ADMIN).json()
    assert revoked["manage_active"] is False
    assert client.patch(f"/communities/{cid}", json={"venue": "Y"}, headers=FREE).status_code == 403


def test_community_tournament_needs_approval(client):
    comm = next(c for c in client.get("/communities", headers=PLAYER).json() if c["name"] == "Tuesday Padel Night")
    assert comm["manage_active"] is True
    body = {"title": f"Approval Cup {uuid.uuid4().hex[:5]}", "sport": "Padel", "kind": "community", "community_id": comm["id"],
            "start_date": "2030-01-01", "max_teams": 4, "team_size": 2}
    t = client.post("/tournaments", json=body, headers=PLAYER).json()
    try:
        assert t["approval_status"] == "pending"
        assert t["id"] not in _ids(client.get("/tournaments?kind=community").json())
        assert client.get(f"/tournaments/{t['id']}").status_code == 404
        assert client.get(f"/tournaments/{t['id']}", headers=PLAYER).status_code == 200
        assert client.post(f"/tournaments/{t['id']}/teams", json={"name": "Early Birds"}, headers=FREE).status_code in (403, 404)
        assert t["id"] in _ids(client.get("/admin/overview", headers=ADMIN).json()["pending_tournaments"])
        assert client.post(f"/admin/tournaments/{t['id']}/approve", headers=PLAYER).status_code == 403
        ok = client.post(f"/admin/tournaments/{t['id']}/approve", headers=ADMIN).json()
        assert ok["approval_status"] == "approved"
        assert t["id"] in _ids(client.get("/tournaments?kind=community").json())
        assert client.post(f"/tournaments/{t['id']}/teams", json={"name": "Early Birds"}, headers=FREE).status_code == 200
    finally:
        client.delete(f"/tournaments/{t['id']}", headers=ADMIN)


def test_admin_tournaments_are_approved_at_once(client):
    t = client.post("/tournaments", json={"title": "Admin Official Cup", "sport": "Football", "kind": "official", "start_date": "2030-02-01"}, headers=ADMIN).json()
    try:
        assert t["approval_status"] == "approved"
    finally:
        client.delete(f"/tournaments/{t['id']}", headers=ADMIN)
