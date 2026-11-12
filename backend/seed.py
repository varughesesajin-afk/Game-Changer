"""Idempotent seed: python seed.py  (wipes and recreates app data, keeps real users)."""
import asyncio
from datetime import date, datetime, timedelta, timezone

from lib.dates import today_iso
from lib.db import db, ensure_indexes
from models.schemas import Community, GameResult, Member, RosterEntry, Team, Tournament
from routers.communities import _game_from, next_dates
from routers.tournaments import _advance, build_bracket

IMG = {
    "Football": "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=1200&q=80",
    "Basketball": "https://images.unsplash.com/photo-1518614368389-5160c0b0de72?w=1200&q=80",
    "Hero": "https://images.unsplash.com/photo-1512746804203-e53e69406f93?w=1200&q=80",
    "Football2": "https://images.unsplash.com/photo-1571080096581-53aefc318ac3?w=1200&q=80",
    "Padel": "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=1200&q=80",
    "Cricket": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&q=80",
    "Volleyball": "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1200&q=80",
    "Tennis": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200&q=80",
}

ADMIN = {"user_id": "user_admin_owner", "email": "varughesesajin@gmail.com", "name": "Sajin Varughese", "role": "admin"}
TESTER = {"user_id": "user_test_player", "email": "test.player@example.com", "name": "Test Player", "role": "user"}
FREE = {"user_id": "user_test_free", "email": "free.player@example.com", "name": "Free Player", "role": "user"}

NAMES = ["Ahmed", "Rahul", "Omar", "Joseph", "Faisal", "Arjun", "Khalid", "Liam", "Yusuf", "Vinay", "Sami", "Noah"]


def d(offset: int) -> str:
    return (date.fromisoformat(today_iso()) + timedelta(days=offset)).isoformat()


async def main():
    import os
    if os.environ.get("ALLOW_SEED") != "1":
        raise SystemExit("seed.py wipes communities, games and tournaments and creates demo/test users. "
                         "Run it only on a throwaway database:  ALLOW_SEED=1 python seed.py")
    now = datetime.now(timezone.utc)
    for c in ["communities", "games", "tournaments", "payment_transactions", "reminders", "gallery"]:  # payment_transactions: leftover from the old paid version
        await db[c].drop()
    await ensure_indexes()

    # users (upsert — keeps real Google users intact)
    await db.users.update_one({"email": ADMIN["email"]}, {"$setOnInsert": {"user_id": ADMIN["user_id"], "name": ADMIN["name"], "picture": None, "created_at": now},
                                                          "$set": {"role": "admin"}}, upsert=True)
    admin = await db.users.find_one({"email": ADMIN["email"]}, {"_id": 0})
    await db.users.update_one({"email": TESTER["email"]}, {"$set": {**TESTER, "picture": None, "is_pro": False,
                              "pro_plan": None, "pro_until": None, "created_at": now}}, upsert=True)
    await db.users.update_one({"email": FREE["email"]}, {"$set": {**FREE, "picture": None, "is_pro": False,
                              "pro_plan": None, "pro_until": None, "created_at": now}}, upsert=True)
    for uid, tok in [(TESTER["user_id"], "test_session_player"), (FREE["user_id"], "test_session_free"),
                     (admin["user_id"], "test_session_admin")]:
        await db.user_sessions.update_one({"session_token": tok}, {"$set": {
            "user_id": uid, "session_token": tok, "expires_at": now + timedelta(days=365), "created_at": now}}, upsert=True)

    # communities + games
    specs = [
        ("Sunday Champions 7v7", "Football", ["Sun", "Tue"], "20:00", 14, 2.0, "Muscat", "Al Khuwair Turf", IMG["Football"], admin),
        ("Tuesday Padel Night", "Padel", ["Tue"], "19:00", 8, 3.0, "Muscat", "Padel Club Qurum", IMG["Padel"], TESTER),
        ("Friday Hoops Run", "Basketball", ["Fri"], "18:30", 10, 1.5, "Muscat", "Sultan Qaboos Sports Complex", IMG["Basketball"], admin),
        ("Beach Volley Crew", "Volleyball", ["Sat"], "17:00", 12, 0.0, "Muscat", "Shatti Al Qurum Beach", IMG["Volleyball"], admin),
        ("Weekend Tape-Ball Cricket", "Cricket", ["Fri", "Sat"], "07:00", 22, 1.0, "Seeb", "Seeb Ground 3", IMG["Cricket"], admin),
    ]
    communities = []
    for i, (name, sport, days, time, mx, fee, city, venue, img, owner) in enumerate(specs):
        members = [Member(user_id=owner["user_id"], name=owner["name"])]
        if owner is admin:
            members.append(Member(user_id=TESTER["user_id"], name=TESTER["name"]))
        c = Community(name=name, sport=sport, days=days, time=time, max_players=mx, fee=fee, city=city, venue=venue,
                      image=img, description=f"Regular {sport.lower()} group. Turn up, add your name, play hard.",
                      owner_id=owner["user_id"], owner_name=owner["name"], members=members,
                      manage_until=d(30) if owner is TESTER else None,
                      created_at=now - timedelta(minutes=i))
        await db.communities.insert_one(c.model_dump())
        communities.append(c)
        for j, gd in enumerate(next_dates(days)):
            g = _game_from(c, gd)
            for k in range(min(mx - 3, 6 + i + j)):
                g.roster.append(RosterEntry(name=NAMES[k % len(NAMES)], team="A" if k % 2 == 0 else "B", added_by=owner["user_id"]))
            await db.games.insert_one(g.model_dump())

    # Tuesday Padel Night is private, with a pending join request from Free Player
    await db.communities.update_one({"id": communities[1].id}, {"$set": {
        "visibility": "private", "join_requests": [Member(user_id=FREE["user_id"], name=FREE["name"]).model_dump()]}})

    # past games with results for leaderboards
    import random
    rnd = random.Random(7)
    for c in communities[:3]:
        for back in (7, 14, 21):
            g = _game_from(c, d(-back))
            for k in range(min(c.max_players, 10)):
                g.roster.append(RosterEntry(name=NAMES[k % len(NAMES)], team="A" if k % 2 == 0 else "B",
                                            added_by=c.owner_id, paid=True, goals=rnd.choice([0, 0, 1, 1, 2, 3])))
            if c.owner_id == TESTER["user_id"] or c.owner_id == admin["user_id"]:
                g.roster.append(RosterEntry(user_id=TESTER["user_id"], name=TESTER["name"], team="A",
                                            added_by=TESTER["user_id"], paid=True, goals=rnd.choice([1, 2])))
            ga = sum(r.goals for r in g.roster if r.team == "A")
            gb = sum(r.goals for r in g.roster if r.team == "B")
            best = max(g.roster, key=lambda r: r.goals)
            g.result = GameResult(winner="A" if ga > gb else "B" if gb > ga else "draw", score_a=ga, score_b=gb,
                                  motm_entry_id=best.id)
            await db.games.insert_one(g.model_dump())

    def teams(names, size, captain):
        return [Team(name=n, captain_id=captain["user_id"], captain_name=captain["name"],
                     players=[NAMES[(i + k) % len(NAMES)] for k in range(size)]) for i, n in enumerate(names)]

    # official tournaments (run by the platform)
    off = [
        Tournament(title="Green Ocean Muscat Football Cup", sport="Football", kind="official", venue="Al Seeb Stadium Annex",
                   city="Muscat", start_date=d(12), entry_fee=40, prize_pool=1000, max_teams=16, team_size=7,
                   description="Our flagship 7-a-side knockout. 16 teams, one champion.", image=IMG["Football2"],
                   organiser_id=admin["user_id"], organiser_name=admin["name"],
                   teams=teams(["Muscat Falcons", "Ruwi Rangers", "Qurum United", "Seeb Strikers", "Bausher FC"], 7, admin)),
        Tournament(title="3x3 Hoops Showdown", sport="Basketball", kind="official", venue="SQ Sports Complex Court 2",
                   city="Muscat", start_date=d(20), entry_fee=15, prize_pool=400, max_teams=8, team_size=3,
                   description="Fast 3x3 street-ball rules. Games to 21.", image=IMG["Hero"],
                   organiser_id=admin["user_id"], organiser_name=admin["name"],
                   teams=teams(["Net Hunters", "Dunk Squad"], 3, admin)),
        Tournament(title="Padel Doubles Open", sport="Padel", kind="official", venue="Padel Club Qurum",
                   city="Muscat", start_date=d(9), entry_fee=10, prize_pool=250, max_teams=16, team_size=2,
                   description="Open doubles draw, all levels welcome.", image=IMG["Padel"],
                   organiser_id=admin["user_id"], organiser_name=admin["name"]),
        Tournament(title="Corporate Cricket Bash", sport="Cricket", kind="official", venue="Amerat Cricket Ground",
                   city="Muscat", start_date=d(30), entry_fee=60, prize_pool=1500, max_teams=8, team_size=11,
                   description="T10 format corporate league.", image=IMG["Cricket"],
                   organiser_id=admin["user_id"], organiser_name=admin["name"]),
    ]
    # community tournament, already running with a live bracket
    live = Tournament(title="Sunday Champions Mini League", sport="Football", kind="community",
                      community_id=communities[0].id, community_name=communities[0].name, venue="Al Khuwair Turf",
                      city="Muscat", start_date=d(-2), entry_fee=5, prize_pool=60, max_teams=8, team_size=7,
                      description="In-house knockout between Sunday regulars.", image=IMG["Football"],
                      organiser_id=admin["user_id"], organiser_name=admin["name"],
                      teams=teams(["Red Devils", "White Wolves", "Blue Bulls", "Green Giants", "Black Panthers", "Gold Rush"], 7, admin))
    live.matches = build_bracket(live.teams)
    live.status = "ongoing"
    first = next(m for m in live.matches if m.round == 1 and m.team_a_id and m.team_b_id)
    first.score_a, first.score_b, first.winner_id = 3, 1, first.team_a_id
    _advance(live.matches, first)
    padel_comm = Tournament(title="Padel Night Americano", sport="Padel", kind="community",
                            community_id=communities[1].id, community_name=communities[1].name, venue="Padel Club Qurum",
                            city="Muscat", start_date=d(6), entry_fee=2, prize_pool=20, max_teams=8, team_size=2,
                            description="Friendly doubles knockout for Tuesday regulars.", image=IMG["Padel"],
                            organiser_id=TESTER["user_id"], organiser_name=TESTER["name"],
                            teams=teams(["Smash Bros", "Lob Stars", "Wall Bangers"], 2, TESTER))
    league = Tournament(title="Winter Futsal League", sport="Football", kind="official", format="groups_knockout",
                        group_count=2, advance_per_group=2, venue="Al Khuwair Turf", city="Muscat", start_date=d(-5),
                        entry_fee=20, prize_pool=300, max_teams=8, team_size=5,
                        description="Two groups of three, top two from each group reach the semi-finals.", image=IMG["Football"],
                        organiser_id=admin["user_id"], organiser_name=admin["name"],
                        teams=teams(["Wadi Warriors", "Mutrah Mariners", "Seeb Sharks", "Qurum Kings", "Azaiba Aces", "Ruwi Rockets"], 5, admin))
    from routers.tournaments import round_robin
    ids = [x.id for x in league.teams]
    groups = [[ids[0], ids[3], ids[4]], [ids[1], ids[2], ids[5]]]
    league.matches = [m for gi, g in enumerate(groups) for m in round_robin(g, 1, "group", "AB"[gi])]
    for m in league.matches[:4]:
        m.score_a, m.score_b = rnd.randint(0, 4), rnd.randint(0, 4)
        m.winner_id = None if m.score_a == m.score_b else (m.team_a_id if m.score_a > m.score_b else m.team_b_id)
    league.status = "ongoing"
    for t in off + [live, padel_comm, league]:
        await db.tournaments.insert_one(t.model_dump())
    # admin-approval demo data: a community waiting for approval, a Manage request, and a tournament waiting for approval
    await db.communities.insert_one(Community(
        name="Thursday Squash Club", sport="Squash", days=["Thu"], time="18:00", max_players=6, fee=1.0, city="Muscat",
        venue="Oman Squash Centre", description="New community waiting for the admin to approve it.",
        owner_id=FREE["user_id"], owner_name=FREE["name"], members=[Member(user_id=FREE["user_id"], name=FREE["name"])],
        approval_status="pending", created_at=now).model_dump())
    await db.communities.update_one({"id": communities[1].id}, {"$set": {"manage_requested_at": now}})
    await db.tournaments.insert_one(Tournament(
        title="Padel Night Summer Cup", sport="Padel", kind="community", community_id=communities[1].id,
        community_name=communities[1].name, venue="Padel Club Qurum", city="Muscat", start_date=d(25), max_teams=8, team_size=2,
        description="Waiting for the admin to approve this tournament.", image=IMG["Padel"], approval_status="pending",
        organiser_id=TESTER["user_id"], organiser_name=TESTER["name"]).model_dump())
    print("seeded", len(communities), "communities,", len(off) + 2, "tournaments")


if __name__ == "__main__":
    asyncio.run(main())
