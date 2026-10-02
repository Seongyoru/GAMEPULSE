# GAMEPULSE — Data sources

Every source GAMEPULSE reads, with its policy status. Facts come from the dated research log in [research/](research/)
(official pages fetched on **2026-10-02**). Nothing here claims an API exists unless it was verified on an official page.

**Collector status** — `ENABLED`: automated collection permitted and implemented · `PENDING_REVIEW`: implementable,
waiting for a terms/legal answer · `DISABLED`: automated collection not permitted · `MANUAL_ONLY`: administrator
input · `FIXTURE_ONLY`: synthetic development data. Only `ENABLED` sources are ever scheduled by the worker.

Source priority: official API → official structured feed → official website → administrator input → trusted fallback.

## Sources present for every game

| Source                                   | Official / Third party | Type                  | Authentication | Rate limit | Content types | Collector status | Notes                                                   |
| ---------------------------------------- | ---------------------- | --------------------- | -------------- | ---------- | ------------- | ---------------- | ------------------------------------------------------- |
| GAMEPULSE fixtures (`<game>-fixture`)    | GAMEPULSE (synthetic)  | Fixture               | —              | —          | all           | `FIXTURE_ONLY`   | Synthetic, always labelled; refused in production       |
| GAMEPULSE manual input (`<game>-manual`) | GAMEPULSE operators    | Manual (JSON via CLI) | DB access      | —          | all           | `MANUAL_ONLY`    | Every item must cite an official URL; `MANUAL_VERIFIED` |

## League of Legends (Riot Games)

| Field                  | Data Dragon                                                                                                                                         | lol-status-v4                                                                                 | Korean patch notes website                                                       | Patch schedule (support article)                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Official / third party | Official                                                                                                                                            | Official                                                                                      | Official                                                                         | Official                                                           |
| Source type            | Official static data (CDN)                                                                                                                          | Official API                                                                                  | Official website                                                                 | Official website                                                   |
| Endpoint               | `ddragon.leagueoflegends.com/api/versions.json`, `/realms/kr.json`, `/cdn/{ver}/data/ko_KR/{champion,item}.json`                                    | `GET https://kr.api.riotgames.com/lol/status/v4/platform-data`                                | `leagueoflegends.com/ko-kr/news/tags/patch-notes/`                               | `support.riotgames.com/.../patch-schedule-league-of-legends`       |
| Authentication         | None                                                                                                                                                | `X-Riot-Token` (dev keys expire every 24 h; public products need a registered production key) | —                                                                                | —                                                                  |
| Rate limit             | None documented                                                                                                                                     | Personal 20/1 s & 100/2 min; production from 500/10 s & 30,000/10 min; honour `Retry-After`   | —                                                                                | —                                                                  |
| Content types          | PATCH (structured stat/item diffs)                                                                                                                  | MAINTENANCE, ANNOUNCEMENT (incidents)                                                         | PATCH                                                                            | PATCH (dates only, PT)                                             |
| Collector status       | Planned (Phase 3)                                                                                                                                   | Planned; needs production key + product registration                                          | `DISABLED` — Riot ToS §7 prohibits bots/scraping of Riot services incl. websites | `MANUAL_ONLY` (example: `fixtures/manual/lol-patch-schedule.json`) |
| Terms review           | 2026-10-02                                                                                                                                          | 2026-10-02                                                                                    | 2026-10-02                                                                       | 2026-10-02                                                         |
| Notes                  | `attackdamageperlevel` was 0 for every champion in 16.19.1 → excluded from diffs. Data Dragon version ≠ client patch label; mapping not documented. | Riot omits empty fields; required legal notice must be displayed.                             | robots.txt allows all, but ToS is binding.                                       | KR deploy time not published → `precision: DATE`.                  |

## Lost Ark (Smilegate STOVE, Korea)

| Field                  | Lost Ark Open API                                                                                                                                                                                         | Official website                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Official / third party | Official                                                                                                                                                                                                  | Official                            |
| Source type            | Official API                                                                                                                                                                                              | Official website                    |
| Endpoint               | `https://developer-lostark.game.onstove.com` — `GET /news/notices?type=`, `GET /news/events` (`Title, Thumbnail, Link, StartDate, EndDate, RewardDate`), `GET /news/alarms`, `GET /gamecontents/calendar` | `lostark.game.onstove.com/News/...` |
| Authentication         | `authorization: bearer {JWT}`                                                                                                                                                                             | —                                   |
| Rate limit             | 100 requests/minute per client; `X-RateLimit-Limit/Remaining/Reset` (epoch s); 503 during maintenance                                                                                                     | —                                   |
| Content types          | EVENT, ANNOUNCEMENT, MAINTENANCE, UPDATE                                                                                                                                                                  | —                                   |
| Collector status       | `PENDING_REVIEW` — terms state storing content violates them; written clarification needed (developer-lostark@smilegate.com)                                                                              | Not used (API preferred)            |
| Terms review           | 2026-10-02                                                                                                                                                                                                | 2026-10-02                          |
| Notes                  | Date fields have no stated zone (KST assumed only with confirmation). Monetization/ads need prior approval.                                                                                               | robots.txt allows all.              |

## MapleStory (NEXON, Korea)

| Field                  | NEXON Open API — notices                                                                                                                                                             | Official website                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Official / third party | Official                                                                                                                                                                             | Official                                    |
| Source type            | Official API                                                                                                                                                                         | Official website                            |
| Endpoint               | `https://open.api.nexon.com` — `/maplestory/v1/notice`, `/notice-update`, `/notice-event` (`date_event_start`, `date_event_end`), `/notice-cashshop`, each with `/detail?notice_id=` | `maplestory.nexon.com/News/...`             |
| Authentication         | `x-nxopen-api-key`                                                                                                                                                                   | —                                           |
| Rate limit             | Development 5/s & 1,000/day; service 500/s & 20,000,000/day; `OPENAPI00007` = 429                                                                                                    | —                                           |
| Content types          | ANNOUNCEMENT, UPDATE, EVENT, (cash shop sales)                                                                                                                                       | —                                           |
| Collector status       | `PENDING_REVIEW` — attribution "Data based on NEXON Open API" required; storage and commercial use need consent; English terms: 30-day data TTL, no advertising use of the data      | Not used — Open API terms prohibit scraping |
| Terms review           | 2026-10-02                                                                                                                                                                           | 2026-10-02                                  |
| Notes                  | Dates are KST with offset (`+09:00`). API is down on patch Thursdays. Character/ranking APIs are player data, not announcements.                                                     | robots.txt disallows `/home`, `/guide`…     |

## Genshin Impact (HoYoverse / COGNOSPHERE)

| Field                  | Official website news                                                                                       | HoYoLAB official posts              | Redemption page                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Official / third party | Official                                                                                                    | Official                            | Official                                         |
| Source type            | Official website                                                                                            | Official website (community)        | Official website                                 |
| Endpoint               | `genshin.hoyoverse.com/ko/news` (channels 395–398)                                                          | `hoyolab.com/circles/2/27/official` | `genshin.hoyoverse.com/ko/gift` (login required) |
| Authentication         | —                                                                                                           | —                                   | Account                                          |
| Rate limit             | —                                                                                                           | —                                   | —                                                |
| Content types          | UPDATE, EVENT, MAINTENANCE, BANNER, ANNOUNCEMENT                                                            | same                                | REDEEM_CODE (no public list)                     |
| Collector status       | `DISABLED` — ToS §7(c) prohibits content being "scraped" without written permission; no documented API/feed | `DISABLED`                          | `MANUAL_ONLY` (codes require official evidence)  |
| Terms review           | 2026-10-02                                                                                                  | 2026-10-02                          | 2026-10-02                                       |
| Notes                  | Korean notices print KST; English print UTC+8 server time. Korean agent: kr_mkt_global@hoyoverse.com        | robots.txt disallows `/genshin`     | —                                                |

## Wuthering Waves (Kuro Games)

| Field                  | Official website news                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Official / third party | Official                                                                                                                                                                       |
| Source type            | Official website                                                                                                                                                               |
| Endpoint               | `wutheringwaves.kurogames.com/kr/main/news/` (Korean locale code `kr`)                                                                                                         |
| Authentication         | —                                                                                                                                                                              |
| Rate limit             | —                                                                                                                                                                              |
| Content types          | UPDATE, EVENT, MAINTENANCE, BANNER (Convene), ANNOUNCEMENT                                                                                                                     |
| Collector status       | `DISABLED` — Terms of Use §2(4) prohibit downloading/copying/displaying content without prior written consent; no documented API/feed                                          |
| Terms review           | 2026-10-02                                                                                                                                                                     |
| Notes                  | Korean site lags the English one (380 vs 701 articles). Korean notices print KST and sometimes mislabel it "server time". Korean agent: wutheringwaves_krsupport@kurogames.com |

## Re-review cadence

Re-check every source's terms and robots policy at least quarterly and before enabling any collector
(`termsReviewedAt` in the source definition). Record findings in a new dated file under `docs/research/`.
