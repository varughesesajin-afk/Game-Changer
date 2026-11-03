# Match Sheet: Goals, Assists, Late Arrivals and Payments

A match sheet the host fills in for each tournament fixture and community game. Each team gets its own section. The host uses each team's player list to record who scored, who assisted, who arrived late and who has paid.

## Who it's for
- **Hosts and organisers** who run community games or tournament fixtures and want one place to record the match.
- **Players and captains**, who can see who scored, who assisted and who was late. They can't edit any of it.

## Core features and experience
- **Goals under each team.** Each team has its own "Add goal" button. The host picks the scorer from a dropdown of that team's registered players. Tournament fixtures use the squad the captain registered. Community games use the players who joined Team A or Team B.
- **Assist for each goal.** Each goal has an optional "Assisted by" dropdown with the same team's players, minus the scorer. It can be left empty.
- **Goals set the score.** The team score is the number of goals recorded for that team, so the scoreline and the scorers always match.
- **Late arrivals.** Each team has a list of its players, and the host ticks "Late" next to anyone who arrived late. Late players are shown under their team on the match. Nothing is deducted.
- **Paid or unpaid, every match.** Each player has a Paid / Unpaid switch for that match. Tournament fixtures get this new switch. Community games already track who has paid, and the same switch appears on the match sheet.
- **Man of the Match** stays as it is today and is picked from the players on the sheet.
- **Where totals appear.** Goals still count towards the tournament top-scorer table and player profiles. Assists show only on the match.

## User flow
1. The host opens a fixture (tournament) or a past game (community) and taps "Match sheet".
2. The sheet shows two team sections side by side, or stacked on a phone.
3. In a team section, the host taps "Add goal", picks the scorer and, if they want, an assister. They repeat this for each goal.
4. In the same section, the host ticks "Late" against players who arrived late and sets Paid / Unpaid for each player.
5. The host picks Man of the Match and taps Save. The fixture shows the score, the scorers with their assists, and late arrivals for each team.
6. Everyone else sees the finished match details but no editing controls.

## Screen preview (phone)

What the host sees on a tournament fixture. A community game looks the same, with Team A and Team B.

```
┌─────────────────────────────────────┐
│ ✕  Match sheet                      │
│ Sun 8 Nov · 19:30 · Pitch 2         │
│                                     │
│   [🛡] Qurum Kings   2 – 1   Azaiba Aces [🛡] │
├─────────────────────────────────────┤
│ [🛡] QURUM KINGS                  2 │
│                                     │
│  Goals                              │
│  ⚽ Ahmed   🅰 Salim            ✕   │
│  ⚽ Ahmed   🅰 —                ✕   │
│  [ + Add goal ]                     │
│    Scorer   [ Choose player   ▾ ]   │
│    Assist   [ No assist       ▾ ]   │
│                                     │
│  Players          Late    Paid      │
│  Ahmed            ☐      [ Paid ]   │
│  Salim            ☑      [Unpaid]   │
│  Khalid           ☐      [ Paid ]   │
│  Yousef           ☑      [Unpaid]   │
│  Late: Salim, Yousef                │
├─────────────────────────────────────┤
│ [🛡] AZAIBA ACES                  1 │
│  ⚽ Faisal  🅰 Joseph           ✕   │
│  [ + Add goal ]                     │
│  Players          Late    Paid      │
│  Faisal           ☐      [ Paid ]   │
│  Joseph           ☐      [ Paid ]   │
│  Hamed            ☐      [Unpaid]   │
├─────────────────────────────────────┤
│ Man of the Match  [ Ahmed       ▾ ] │
│                                     │
│ [        Save match sheet        ]  │
└─────────────────────────────────────┘
```

What players and captains see on the fixture after it's saved. They can't edit anything.

```
┌─────────────────────────────────────┐
│ Qurum Kings  2 – 1  Azaiba Aces     │
│ Sun 8 Nov · 19:30 · Pitch 2         │
│ ⚽ Ahmed ×2 (assist Salim)          │
│ ⚽ Faisal (assist Joseph)           │
│ ⭐ Man of the Match: Ahmed          │
│ ⏰ Late — Qurum Kings: Salim, Yousef│
└─────────────────────────────────────┘
```

How the dropdowns work:
- The **Scorer** dropdown lists only that team's registered players.
- The **Assist** dropdown lists the same players minus the scorer, plus "No assist".
- After each goal is added, the team score at the top goes up by one.
- **Paid / Unpaid** turns green when paid. Late players are summed up under each team.

## UI/UX feel
- Same blue/green Green Ocean look and team badges as today.
- Each team section is a card with the team badge and name.
- Goals are listed one per row as "⚽ Scorer · 🅰 Assister", each with a remove button.
- Each player row has a compact "Late" tick and a Paid / Unpaid toggle, green for paid and grey for unpaid.
- Built for one-handed phone use: one column on phones and large tap targets.

## Implementation phases
**Phase 1 (MVP, built now)**
- A match sheet for tournament fixtures and community games, with a section for each team.
- Goals per team chosen from a player dropdown, an optional assist, and the score taken from the goals.
- A "Late" tick for each player, shown on the match.
- Paid / Unpaid for each player in each match.
- Existing goal totals, top-scorer table and player profiles keep working.

**Phase 2**
- A count of how often each player has been late, shown on their profile.
- A list of unpaid players across all matches for the host, with one-tap reminders.

**Phase 3**
- Goal minutes and a simple match timeline.
- An assists leaderboard, if wanted later.

## Assumptions
- **Who can edit.** Only the host or organiser, or the site admin, can edit a match sheet. Captains can't.
- **Tournament players.** The dropdown shows the squad names the captain registered, which aren't linked to app accounts. Tournament goals and assists therefore still don't count on personal profiles.
- **Late means late.** "Late" is a yes/no tick for each player, with no minutes and no penalty.
- **Payment status.** Paid / Unpaid is a record only; no money changes hands in the app. Players default to Unpaid. Community games already track this, and the sheet uses that same record.
- **Own goals.** These aren't handled in Phase 1. The host credits the goal to the benefiting team without a scorer, shown as "Unassigned goal".
- **Old results.** Results already entered keep their scorers. They simply have no assists or late marks.
