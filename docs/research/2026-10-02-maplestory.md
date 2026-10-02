# Source research — MapleStory KR (NEXON)

- **Date:** 2026-10-02
- **Method:** official pages, the published OpenAPI YAML and two unauthenticated API calls (error format only).
- **Labels:** **[V]** seen on an official page/response on the research date · **[U]** unverified.
- **Status:** research input for `docs/DATA_SOURCES.md` and `docs/LEGAL_NOTES.md`. Not legal advice.

## NEXON Open API — notice endpoints [V]

- Spec: https://openapi.nexon.com/static/api/maplestory/27_ko_script20251218035959.yaml (tab "공지 정보 조회" on
  https://openapi.nexon.com/ko/game/maplestory/).
- Base URL `https://open.api.nexon.com`; all `GET`; header `x-nxopen-api-key`.
- List endpoints take no parameters and return the 20 most recent posts; detail endpoints need `notice_id` (int64).

| Path                                    | Response fields                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/maplestory/v1/notice`                 | `notice[]`: `title`, `url`, `notice_id`, `date`                                                              |
| `/maplestory/v1/notice/detail`          | `title`, `url`, `contents`, `date`                                                                           |
| `/maplestory/v1/notice-update`          | `update_notice[]`: `title`, `url`, `notice_id`, `date`                                                       |
| `/maplestory/v1/notice-update/detail`   | `title`, `url`, `contents`, `date`                                                                           |
| `/maplestory/v1/notice-event`           | `event_notice[]`: `title`, `url`, `notice_id`, `date`, `date_event_start`, `date_event_end`                  |
| `/maplestory/v1/notice-event/detail`    | `title`, `url`, `contents`, `date`, `date_event_start`, `date_event_end`                                     |
| `/maplestory/v1/notice-cashshop`        | `cashshop_notice[]`: `title`, `url`, `notice_id`, `date`, `date_sale_start`, `date_sale_end`, `ongoing_flag` |
| `/maplestory/v1/notice-cashshop/detail` | `title`, `url`, `contents`, `date`, `date_sale_start`, `date_sale_end`, `ongoing_flag`                       |

- Dates are KST strings with an offset, e.g. `"2023-12-21T00:00+09:00"`; `notice_id` is a number; `ongoing_flag` is
  a string. The spec recommends real-time lookups or at least a daily batch.
- A thumbnail field was added to the event/cash-shop list APIs on 2025-12-18 but is absent from the YAML [U] —
  parse unknown fields tolerantly.
- Notice APIs launched 2024-07-18 (https://openapi.nexon.com/ko/support/notice/2604201/).
- Character, union, guild, ranking, history and scheduler APIs are player data — **not** announcement APIs.

## Keys, limits, errors [V]

- Header `x-nxopen-api-key` (https://openapi.nexon.com/ko/guide/request-api/).
- Development key: 5 req/s, 1,000 req/day. Service key: 500 req/s, 20,000,000 req/day (needs a valid service URL).
- Over quota → key temporarily blocked until the next cycle. Keys don't expire but may be deleted after a year unused.
- Error body: `{"error":{"name":"OPENAPI000xx","message":"..."}}`. Observed: no key → 400 `OPENAPI00004`; bad key →
  400 `OPENAPI00005`. Codes: 00007 → 429 rate limit; 00009 data being prepared; 00010 game maintenance; 00011 → 503
  API maintenance. Match on HTTP status plus name prefix (the FAQ spells some codes with an extra zero).
- No rate-limit headers documented.
- The MapleStory API is taken down on patch Thursdays (e.g. 2026-09-17 07:00–13:00 KST).

## Terms [V]

- Korean Open API terms (effective 2024-09-09, https://openapi.nexon.com/ko/support/terms/):
  - 6조④ attribution required; the guide fixes the wording **"Data based on NEXON Open API"**.
  - 5조⑤ no copying/storing/processing/distributing result data beyond what the terms allow without consent;
    11조③ delete all result data on termination.
  - 6조⑥ no commercial use without consent. 5조⑧ no automated access that overloads NEXON systems.
- English-locale terms (updated 2025-04-21, https://openapi.nexon.com/support/terms/) are a different document:
  8.4 identify Nexon as the source; 8.7 **maximum 30-day TTL** for game data; 8.2 no advertising use of the data;
  8.13 no commercial use without a written agreement; 8.15 no scraping or crawling.
- Which version binds a Korean developer is unclear → build to the stricter set (30-day retention, no ads next to
  API data without agreement) and obtain legal review.

## Reset times (KST) — official game guide articles

Base: https://maplestory.nexon.com/Guide/N23GameInformation/Articles/

- Daily 00:00 [V] (G425: "매일 오전 0시 초기화되며, 주간 컨텐츠는 목요일 오전 0시에 초기화").
- Weekly content/quests Thursday 00:00 [V] (G465, G470, G391). Weekly boss clear reset on Thursday 00:00 is
  inferred from G425/G458 [U].
- Monthly boss (Black Mage) once a month; reset on the 1st at 00:00 is commonly reported [U].
- Patch day: Thursdays (https://maplestory.nexon.com/News/Update) [V].

## robots.txt and site terms [V]

- https://maplestory.nexon.com/robots.txt disallows `/home`, `/guide`, `/community`, `/support`, `/common` (and case
  variants) while allowing `/Guide/N23GameInformation`; `/News` is not listed.
- NEXON integrated terms (https://member.nexon.com/policy/stipulation.aspx, 제11조①) prohibit copying/distributing or
  commercially using obtained information without prior consent.
- Conclusion: **no scraping of maplestory.nexon.com**; use the Open API (after legal review) or manual ingestion.
