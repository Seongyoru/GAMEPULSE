# GAMEPULSE — Data sources

Every source GAMEPULSE reads, with its policy status. Facts come from the dated research log in [research/](research/)
(official pages fetched on **2026-10-02**). Nothing here claims an API exists unless it was verified on an official page.

**Collector status** — `ENABLED`: automated collection permitted and implemented · `PENDING_REVIEW`: implementable,
waiting for a terms/legal answer · `DISABLED`: automated collection not permitted · `MANUAL_ONLY`: administrator
input · `FIXTURE_ONLY`: synthetic development data. Only `ENABLED` sources are ever scheduled by the worker.

Source priority: official API → official structured feed → official website → administrator input → trusted fallback.

## Adapters at a glance

| Adapter              | Game       | Source                                      | Collector status | Credentials          | Produces                                    |
| -------------------- | ---------- | ------------------------------------------- | ---------------- | -------------------- | ------------------------------------------- |
| `<game>-fixture`     | all        | synthetic feeds (`fixtures/sources`)        | `FIXTURE_ONLY`   | —                    | every content type                          |
| `lol-ddragon`        | LoL        | Riot Data Dragon                            | `ENABLED`        | —                    | PATCH with structured stat/spell/item diffs |
| `lol-status`         | LoL        | Riot lol-status-v4 (KR)                     | `PENDING_REVIEW` | `RIOT_API_KEY`       | MAINTENANCE, ANNOUNCEMENT                   |
| `lostark-openapi`    | Lost Ark   | Lost Ark Open API                           | `PENDING_REVIEW` | `LOSTARK_API_KEY`    | EVENT, REWARD, MAINTENANCE, ANNOUNCEMENT    |
| `maplestory-openapi` | MapleStory | NEXON Open API notices                      | `PENDING_REVIEW` | `NEXON_OPEN_API_KEY` | EVENT, UPDATE, MAINTENANCE, ANNOUNCEMENT    |
| —                    | Genshin    | official website (`genshin-official-web`)   | `DISABLED`       | —                    | manual ingestion only                       |
| —                    | WuWa       | official website (`wuwa-official-web`)      | `DISABLED`       | —                    | manual ingestion only                       |
| —                    | ZZZ\*      | official website (`zzz-official-web`)       | `DISABLED`       | —                    | manual ingestion only                       |
| —                    | LoL        | patch-notes website (`lol-patch-notes-web`) | `MANUAL_ONLY`    | —                    | manual ingestion only                       |

Every live adapter also runs in `mock` mode against `fixtures/http/<adapter>/` and stores those records under a
synthetic twin source `<source>-mock` (`FIXTURE`), never under the official source.

\* Zenless Zone Zero is registered but `INACTIVE` (hidden until launch, D-035). Neverness to Everness is researched
but not registered (see below and ROADMAP › Game backlog).

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
| Collector status       | `ENABLED` — adapter `lol-ddragon` (every 3 h, conditional requests)                                                                                 | `PENDING_REVIEW` — adapter `lol-status`; needs production key + product registration          | `DISABLED` — Riot ToS §7 prohibits bots/scraping of Riot services incl. websites | `MANUAL_ONLY` (example: `fixtures/manual/lol-patch-schedule.json`) |
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
| Content types          | EVENT, REWARD (claim deadline from `RewardDate`), MAINTENANCE (window not in the API), ANNOUNCEMENT                                                                                                       | —                                   |
| Collector status       | `PENDING_REVIEW` — adapter `lostark-openapi`; terms state storing content violates them; written clarification needed (developer-lostark@smilegate.com)                                                   | Not used (API preferred)            |
| Terms review           | 2026-10-02                                                                                                                                                                                                | 2026-10-02                          |
| Notes                  | Date fields carry no offset; the KR service API is declared KST by source policy (confirm on the first live response). Thumbnails are never stored. Monetization/ads need prior approval.                 | robots.txt allows all.              |

## MapleStory (NEXON, Korea)

| Field                  | NEXON Open API — notices                                                                                                                                                              | Official website                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Official / third party | Official                                                                                                                                                                              | Official                                    |
| Source type            | Official API                                                                                                                                                                          | Official website                            |
| Endpoint               | `https://open.api.nexon.com` — `/maplestory/v1/notice`, `/notice-update`, `/notice-event` (`date_event_start`, `date_event_end`), `/notice-cashshop`, each with `/detail?notice_id=`  | `maplestory.nexon.com/News/...`             |
| Authentication         | `x-nxopen-api-key`                                                                                                                                                                    | —                                           |
| Rate limit             | Development 5/s & 1,000/day; service 500/s & 20,000,000/day; `OPENAPI00007` = 429                                                                                                     | —                                           |
| Content types          | EVENT, UPDATE, MAINTENANCE (title contains 점검), ANNOUNCEMENT — cash-shop sales and detail bodies are not requested                                                                  | —                                           |
| Collector status       | `PENDING_REVIEW` — adapter `maplestory-openapi`; attribution "Data based on NEXON Open API" required; storage and commercial use need consent; English terms: 30-day data TTL, no ads | Not used — Open API terms prohibit scraping |
| Terms review           | 2026-10-02                                                                                                                                                                            | 2026-10-02                                  |
| Notes                  | Dates are KST with offset (`+09:00`). API is down on patch Thursdays. Character/ranking APIs are player data, not announcements.                                                      | robots.txt disallows `/home`, `/guide`…     |

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

## Zenless Zone Zero (HoYoverse) — registered, hidden

Research: [2026-10-02-zzz-nte.md](research/2026-10-02-zzz-nte.md).

| Field                  | Official website news                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official / third party | Official                                                                                                                                              |
| Source type            | Official website (plus the official HoYoLAB account)                                                                                                  |
| Endpoint               | `zenless.hoyoverse.com/ko-kr/news` (category 296 = 공지사항); redeem codes at `zenless.hoyoverse.com/redemption` (login required)                     |
| Authentication         | —                                                                                                                                                     |
| Rate limit             | —                                                                                                                                                     |
| Content types          | UPDATE, EVENT, BANNER (채널), REWARD, REDEEM_CODE, MAINTENANCE, ANNOUNCEMENT                                                                          |
| Collector status       | `DISABLED` — ToS §7(c) prohibits content being "scraped" without written permission (이용약관 제8조 8)); no documented API/feed; robots.txt 404       |
| Terms review           | 2026-10-02                                                                                                                                            |
| Notes                  | Korean notices print KST ("(KST)"), older ones mix unconverted "(서버 시간)" values and write "24:59(KST)". Korean agent: kr_mkt_global@hoyoverse.com |

## Neverness to Everness (Perfect World) — researched, not registered

| Field                  | Official website news                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official / third party | Official                                                                                                                                                                                                                    |
| Source type            | Official website                                                                                                                                                                                                            |
| Endpoint               | `nte.perfectworld.com/kr/article/news/` (뉴스 `gamenews`, 공지 `gamebroad`, 이벤트 `gameevent`)                                                                                                                             |
| Content types          | UPDATE, EVENT, BANNER (한정 보드), REWARD, REDEEM_CODE (in game only), MAINTENANCE                                                                                                                                          |
| Collector status       | Not registered. Automated collection `DISABLED` (EN ToS §3.4(s), §6.1(b)(iv); KO 이용약관 제4조②). §3.4(s) also covers "any manual process to do the same" → written permission or legal review **before manual ingestion** |
| Terms review           | 2026-10-02                                                                                                                                                                                                                  |
| Notes                  | Launched in Korea 2026-04-29. Daily/weekly reset (05:00 server time?) and per-server offsets are not officially stated. Contacts: nte.legal@perfectworld.com, Korean agent per 이용약관                                     |

## Re-review cadence

Re-check every source's terms and robots policy at least quarterly and before enabling any collector
(`termsReviewedAt` in the source definition). Record findings in a new dated file under `docs/research/`.
