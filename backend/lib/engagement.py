"""Man-of-the-match voting and player badges / streaks.

* Voting opens when the host first saves a game's result and runs for 24 hours. The player with the most votes becomes the
  game's man of the match (written to result.motm_entry_id, so leaderboards and profiles pick it up). Ties go to the host's
  pick, then to the player with more goals. If nobody votes, the host's pick stands.
* Badges are worked out from the played games (nothing to maintain by hand); `user_badges` only remembers when each one was
  first earned so we can announce new ones once.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from lib.db import db
from lib.push import _once, notify
from models.schemas import Badge, BadgesOut, Game

logger = logging.getLogger(__name__)

VOTE_HOURS = 24


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    d = _utc(dt)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ") if d else None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def vote_status(g: Game) -> str:
    if not g.result or not g.motm_closes_at:
        return "none"
    if g.motm_final or _utc(g.motm_closes_at) <= _now():
        return "closed"
    return "open"


# ---------- voting ----------
async def open_voting(g: Game) -> None:
    """Called after a result is saved: start the 24h window once, and tell the players to vote."""
    if not g.result or g.motm_closes_at or len({r.id for r in g.roster}) < 2:
        return
    closes = _now() + timedelta(hours=VOTE_HOURS)
    res = await db.games.update_one({"id": g.id, "motm_closes_at": None}, {"$set": {"motm_closes_at": closes}})
    if not res.modified_count:  # field missing on old docs: match that too
        res = await db.games.update_one({"id": g.id, "motm_closes_at": {"$exists": False}}, {"$set": {"motm_closes_at": closes}})
    if not res.modified_count:
        return
    for uid in {r.user_id for r in g.roster if r.user_id}:
        if await _once(f"vote:{g.id}:{uid}"):
            await notify([uid], "Vote for man of the match", f"{g.community_name} · {g.date}. Voting is open for {VOTE_HOURS} hours.",
                         f"/communities/{g.community_id}?vote={g.id}", f"vote-{g.id}")


async def finalize_game(g: Game) -> None:
    if g.motm_final or not g.result:
        return
    votes = await db.motm_votes.find({"game_id": g.id}, {"_id": 0, "entry_id": 1}).to_list(500)
    tally: Dict[str, int] = {}
    for v in votes:
        tally[v["entry_id"]] = tally.get(v["entry_id"], 0) + 1
    ids = {r.id for r in g.roster}
    tally = {k: n for k, n in tally.items() if k in ids}
    winner = g.result.motm_entry_id  # the host's pick stands when nobody voted
    if tally:
        top = max(tally.values())
        tied = [k for k, n in tally.items() if n == top]
        goals = {r.id: r.goals for r in g.roster}
        if g.result.motm_entry_id in tied:
            winner = g.result.motm_entry_id
        else:
            winner = sorted(tied, key=lambda k: (-goals.get(k, 0), [r.id for r in g.roster].index(k)))[0]
    claimed = await db.games.update_one({"id": g.id, "motm_final": {"$ne": True}},
                                        {"$set": {"motm_final": True, "result.motm_entry_id": winner}})
    if not claimed.modified_count:
        return
    entry = next((r for r in g.roster if r.id == winner), None)
    if entry:
        users = {r.user_id for r in g.roster if r.user_id}
        for uid in users:
            if entry.user_id == uid:
                if await _once(f"motmwin:{g.id}:{uid}"):
                    await notify([uid], "You're man of the match!", f"You won the vote for {g.community_name} ({g.date}).", f"/communities/{g.community_id}", f"motm-{g.id}")
            elif await _once(f"motmres:{g.id}:{uid}"):
                await notify([uid], "Man of the match", f"{entry.name} won the vote for {g.community_name} ({g.date}).", f"/communities/{g.community_id}", f"motm-{g.id}")
        if entry.user_id:
            await award_badges([entry.user_id])


async def finalize_due() -> int:
    """Count every vote whose window has ended; nudge players who haven't voted when it is about to close."""
    now = _now()
    n = 0
    for d in await db.games.find({"motm_closes_at": {"$lte": now}, "motm_final": {"$ne": True}}, {"_id": 0}).to_list(200):
        await finalize_game(Game(**d))
        n += 1
    soon = now + timedelta(hours=6)
    for d in await db.games.find({"motm_closes_at": {"$gt": now, "$lte": soon}, "motm_final": {"$ne": True}}, {"_id": 0}).to_list(200):
        g = Game(**d)
        voted = {v["voter_id"] for v in await db.motm_votes.find({"game_id": g.id}, {"_id": 0, "voter_id": 1}).to_list(500)}
        for uid in {r.user_id for r in g.roster if r.user_id} - voted:
            if await _once(f"vclose:{g.id}:{uid}"):
                await notify([uid], "Voting closes soon", f"Pick your man of the match for {g.community_name} ({g.date}).",
                             f"/communities/{g.community_id}?vote={g.id}", f"vote-{g.id}")
    return n


# ---------- badges ----------
BADGES = [
    # id, name, description, icon, kind, target
    ("first_game", "First game", "Play your first game", "medal", "games", 1),
    ("first_win", "First win", "Be on the winning side once", "trophy", "wins", 1),
    ("wins_5", "Five wins", "Win 5 games", "trophy", "wins", 5),
    ("hat_trick", "Hat-trick", "Score 3 goals in one game", "goal", "best_goals", 3),
    ("goals_10", "10 goals", "Score 10 goals in total", "goal", "goals", 10),
    ("motm", "Man of the match", "Win the man-of-the-match vote", "star", "motm", 1),
    ("motm_3", "Fan favourite", "Be man of the match 3 times", "star", "motm", 3),
    ("streak_3", "3 in a row", "Play 3 games in a row", "flame", "best_streak", 3),
    ("streak_5", "5 in a row", "Play 5 games in a row", "flame", "best_streak", 5),
    ("games_10", "Regular", "Play 10 games", "medal", "games", 10),
    ("games_25", "Ever-present", "Play 25 games", "medal", "games", 25),
    ("payer", "Always pays", "Pay for 3 games and never owe a fee", "coins", "paid_clean", 3),
]


async def _stats(uid: str) -> dict:
    docs = await db.games.find({"roster.user_id": uid, "result": {"$ne": None}}, {"_id": 0}).sort("date", 1).to_list(3000)
    games = [Game(**d) for d in docs]
    st = dict(games=0, wins=0, goals=0, best_goals=0, motm=0, paid=0, unpaid=0)
    for g in games:
        r = next((x for x in g.roster if x.user_id == uid), None)
        if not r:
            continue
        st["games"] += 1
        st["wins"] += g.result.winner == r.team
        st["goals"] += r.goals
        st["best_goals"] = max(st["best_goals"], r.goals)
        st["motm"] += g.result.motm_entry_id == r.id
        if g.fee > 0:
            st["paid" if r.paid else "unpaid"] += 1
    st["paid_clean"] = st["paid"] if st["unpaid"] == 0 else 0
    # streaks: consecutive completed games of a community that the player was on, counted from their first one there
    best = current = 0
    for cid in {g.community_id for g in games}:
        run = 0
        started = False
        for d in await db.games.find({"community_id": cid, "result": {"$ne": None}}, {"_id": 0, "roster.user_id": 1, "date": 1}).sort("date", 1).to_list(3000):
            on = any(x.get("user_id") == uid for x in d.get("roster", []))
            if on:
                started = True
                run += 1
                best = max(best, run)
            elif started:
                run = 0
        current = max(current, run)
    st["best_streak"], st["current_streak"] = best, current
    return st


async def badges_for(uid: str, notify_new: bool = False) -> BadgesOut:
    st = await _stats(uid)
    have = {b["badge_id"]: b["at"] async for b in db.user_badges.find({"user_id": uid}, {"_id": 0})}
    earned_now = [b for b in BADGES if st[b[4]] >= b[5]]
    new = [b for b in earned_now if b[0] not in have]
    if new:
        now = _now()
        for b in new:
            try:
                await db.user_badges.insert_one({"user_id": uid, "badge_id": b[0], "at": now})
            except Exception:  # raced with another request
                pass
            have[b[0]] = now
        # announce, unless this is the first sync for someone who already earned a pile of them (a silent back-fill)
        if notify_new and (len(new) <= 2 or len(new) < len(earned_now)):
            names = ", ".join(b[1] for b in new[:3])
            await notify([uid], "Badge unlocked" if len(new) == 1 else "New badges unlocked", names, "/profile", f"badge-{uid}")
    out = []
    for bid, name, desc, icon, kind, target in BADGES:
        prog = min(st[kind], target)
        out.append(Badge(id=bid, name=name, description=desc, icon=icon, earned=bid in have, progress=prog, target=target,
                         earned_at=_iso(_utc(have.get(bid)))))
    out.sort(key=lambda b: (not b.earned, -(b.progress / b.target), b.name))
    return BadgesOut(user_id=uid, current_streak=st["current_streak"], best_streak=st["best_streak"],
                     earned=sum(b.earned for b in out), total=len(out), badges=out)


async def award_badges(user_ids: List[str]) -> None:
    for uid in dict.fromkeys(u for u in user_ids if u):
        try:
            await badges_for(uid, notify_new=True)
        except Exception:
            logger.exception("award_badges failed for %s", uid)


async def after_result(game_id: str) -> None:
    """Hook for the result / match-sheet endpoints: open the vote and refresh the roster's badges."""
    d = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not d:
        return
    g = Game(**d)
    try:
        await open_voting(g)
    except Exception:
        logger.exception("open_voting failed")
    await award_badges([r.user_id for r in g.roster if r.user_id])
