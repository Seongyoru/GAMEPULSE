# GAMEPULSE — Product

> **All Your Games. One Pulse.**
>
> GAMEPULSE is not an archive of game announcements. It is a real-time personal dashboard that tells
> players what matters in all of their games **today**.

## The three questions

Every screen exists to answer, as quickly as possible:

1. **What changed in my games today?** — patches, updates, maintenance, important notices
2. **What rewards should I claim today?** — event rewards, attendance, compensation, redeem codes
3. **What resets or expires today?** — daily/weekly resets, events and banners ending soon

## North-star experience

A returning user understands the important status of all their games in **~10 seconds**:

```
TODAY · 2026.10.02
Your games have 8 updates today.
UPDATE 2 · REWARD 3 · RESET 2 · ENDING SOON 1

LEAGUE OF LEGENDS   Patch 26.19 · 3 champion changes   Next patch D-5
LOST ARK            Weekly reset 03:42:18               Rewards 4 available
GENSHIN IMPACT      Events 5 · ending D-2               Current wish D-20
```

Information hierarchy and readability beat decoration.

## Target behavior loop

```
Search / social → detail page → add game to MY GAMES → TODAY dashboard → bookmark / PWA → daily direct visits
```

Repeated usage (returning users, MY GAMES setup rate, TODAY visits) is the core metric — not raw page views.

## MVP scope (Alpha)

| Area            | Scope                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Games           | League of Legends, Lost Ark, MapleStory, Genshin Impact, Wuthering Waves                                                                                                        |
| Modules         | PULSE stream, PATCH, EVENT, REWARD, RESET, CALENDAR                                                                                                                             |
| Pages           | `/`, `/today`, `/games`, `/games/[game]` (+ patches, events, rewards, resets, calendar), `/patches/[slug]`, `/events/[slug]`, `/rewards/[slug]`, `/notices/[slug]`, `/calendar` |
| Personalization | MY GAMES stored locally (no account), behind a sync-ready abstraction                                                                                                           |
| Market          | South Korea first (`ko-KR`, `Asia/Seoul`); data model and routing ready for `en-US`, `ja-JP`, `zh-TW`                                                                           |
| Data            | Official sources first; fixtures and manual ingestion when collection is unavailable or not permitted                                                                           |

Content categories: PATCH, UPDATE, EVENT, REWARD, REDEEM CODE, MAINTENANCE, BANNER, ANNOUNCEMENT (stored);
RESET (recurring rules) and DEADLINE/ENDING SOON (computed from end times).

### TODAY ordering (urgency)

1. maintenance in progress
2. expires in < 6h
3. claimable reward
4. expires in < 24h
5. reset in < 24h
6. new patch
7. new event
8. upcoming

Sections: Critical Changes · Rewards · Resets · Ending Soon · New Events · Maintenance · Upcoming.
MY GAMES users see their games; anonymous users see the default set.

## Trust principles

- Every detail page shows the **official source**, **last updated**, and that GAMEPULSE **parsed/structured** it.
- Users can always reach the original source.
- Synthetic fixture data is always labelled as sample data; synthetic redeem codes start with `GPTEST-` and are
  displayed as not usable.
- Unknown values stay unknown: no invented dates, rewards, values or codes (including from AI).
- Reset schedules show their verification state until a human confirms them.

## Design direction

Real-time, data-driven, fast, modern, game-neutral, professional — _Bloomberg-lite + sports scoreboard + modern
gaming dashboard_. Avoid childish gamer aesthetics, excessive neon, fantasy UI, glassmorphism, noisy backgrounds,
giant artwork and excessive animation. Information dominates.

## Advertising and analytics readiness

- `AdSlot` placements exist but are disabled by default; ads must never disguise themselves as content, shift layout
  or compromise the 10-second goal. No provider is integrated.
- Analytics events (`game_selected`, `game_removed`, `pulse_opened`, `patch_opened`, `reward_opened`,
  `calendar_filtered`, `source_clicked`, `my_games_configured`) go through a provider abstraction with a no-op default.

## Success metrics (instrumentation-ready)

Daily active users · returning-user rate · MY GAMES setup rate · TODAY visits · pages per session · organic search
visits · game-detail → MY GAMES conversion · 7-day returning users.

## Out of scope for the MVP

Forums, comments, chat, user posts, guilds, social feed, complex accounts, DMs, marketplace, launcher, desktop client,
native apps, user-generated guides.

## Designed-for future features

Push/Discord/Telegram notifications · accounts with cloud-synced MY GAMES · PWA · English/Japanese localization ·
more games · release calendar · public API · historical patch analytics · trend detection.
