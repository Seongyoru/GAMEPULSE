# Source research — League of Legends (Riot) and Lost Ark KR (Smilegate STOVE)

- **Date:** 2026-10-02
- **Method:** official pages and API responses fetched directly (unauthenticated where keys were unavailable).
- **Labels:** **[V]** seen on an official page/response on the research date · **[U]** commonly reported or not confirmable.
- **Status:** research input for `docs/DATA_SOURCES.md` and `docs/LEGAL_NOTES.md`. Not legal advice; every
  production decision listed as "needs review" requires a human/legal sign-off.

## A. League of Legends

### lol-status-v4 (Riot Developer API)

- Endpoint [V]: `GET https://kr.api.riotgames.com/lol/status/v4/platform-data` → `PlatformDataDto`
  (https://developer.riotgames.com/apis#lol-status-v4, https://developer.riotgames.com/docs/lol#routing-values).
- Schema [V]:
  - `PlatformDataDto`: `id`, `name`, `locales[]`, `maintenances[StatusDto]`, `incidents[StatusDto]`
  - `StatusDto`: `id` (int), `maintenance_status` (scheduled|in_progress|complete), `incident_severity`
    (info|warning|critical), `titles[ContentDto]`, `updates[UpdateDto]`, `created_at`, `archive_at`,
    `updated_at`, `platforms[]`
  - `ContentDto`: `locale`, `content` (use `locale == "ko_KR"`)
  - `UpdateDto`: `id`, `author`, `publish`, `publish_locations[]`, `translations[ContentDto]`, `created_at`, `updated_at`
- Riot APIs omit empty values (zero, empty strings/lists, null) [V] (https://developer.riotgames.com/docs/portal).
- Auth header `X-Riot-Token` [V, observed]: no key → 401 "apikey or authorization header is empty"; unknown key → 401
  "Unknown apikey". Docs mention 403 for invalid keys — handle both.
- Keys [V]: development keys deactivate every 24 hours; "You may not maintain a public product with a development API
  key". Production keys require a registered product and a verified website (https://developer.riotgames.com/docs/faqs).
- Rate limits [V]: personal key 20 req/1 s and 100 req/2 min; production starts at 500 req/10 s and 30,000 req/10 min.
  On 429, halt for `Retry-After` seconds. `X-App-Rate-Limit*` / `X-Method-Rate-Limit*` header names are commonly
  reported [U] (could not be observed without a key).
- Keyless status JSON used by status.riotgames.com exists but is undocumented and has no SLA; Riot's general
  policies say products should use supported services → **not used**.

### Data Dragon

- Latest version on the research date [V]: `16.19.1` (https://ddragon.leagueoflegends.com/api/versions.json); KR realm
  file https://ddragon.leagueoflegends.com/realms/kr.json → `"v":"16.19.1","l":"ko_KR"`.
- URL patterns [V] (https://developer.riotgames.com/docs/lol#data-dragon):
  `https://ddragon.leagueoflegends.com/cdn/{ver}/data/ko_KR/champion.json`, `…/champion/{Id}.json`, `…/item.json`.
- No key required; `Access-Control-Allow-Origin: *`; `Last-Modified` present; no documented rate limit [V].
- Usage notes [V]: updates are manual and not always immediate after a patch; versions are not always equal to the
  client version in a region → use the realm file.
- `champion.json` → `data.<Id>.stats` has 20 numeric keys (hp, hpperlevel, mp, mpperlevel, movespeed, armor,
  armorperlevel, spellblock, spellblockperlevel, attackrange, hpregen, hpregenperlevel, mpregen, mpregenperlevel,
  crit, critperlevel, attackdamage, attackdamageperlevel, attackspeedperlevel, attackspeed).
  **Data quality issue:** `attackdamageperlevel` was 0 for all 173 champions in 16.19.1 → excluded from diffs.
- `item.json` → `data.<itemId>.gold` = `{base, purchasable, total, sell}`, `stats` = map of stat name → number.
  Filter Summoner's Rift with `maps["11"]` and `gold.purchasable`.
- Patch 26.19 appears to correspond to Data Dragon 16.19.1 — **inferred, not documented** [U]. GAMEPULSE labels
  Data Dragon output with the Data Dragon version and does not claim the mapping.

### Policies

- Required notice [V] (https://developer.riotgames.com/policies/general, updated 2025-05-29), in a place readily
  visible to players:
  > [Your product] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
  > officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are
  > trademarks or registered trademarks of Riot Games, Inc.
- Products serving players must be registered with Riot regardless of API use [V] (https://developer.riotgames.com/docs/lol).
- Monetization requires an Approved/Acknowledged registration and a free tier [V].
- No Riot trademarks in domain names / product names / search keywords [V] (https://www.riotgames.com/en/legal).

### Korean patch notes (website)

- List page [V]: https://www.leagueoflegends.com/ko-kr/news/tags/patch-notes/ ; article pattern
  `/ko-kr/news/game-updates/league-of-legends-patch-{YY}-{N}-notes/`.
- robots.txt [V]: `User-agent: * / Allow: /`.
- Riot Terms of Service [V] (https://www.riotgames.com/en/terms-of-service, §7) prohibit "scripts, bots … automation
  programs that interact with the Riot Services" (Riot Services includes websites) and routines that "scrape".
  → **Patch-notes web collection is not enabled.** Patch notes enter via manual ingestion with the official URL.

### Official 2026 patch schedule [V]

https://support.riotgames.com/en-us/league-of-legends/gameplay/patch-schedule-league-of-legends (updated 2026-05-26):
patches release on a Wednesday (PT). Upcoming: 26.20 Oct 7 · 26.21 Oct 21 · 26.22 Nov 4 · 26.23 Nov 18 · 26.24 Dec 9.
The KR deployment time is not stated → date-only precision.

## B. Lost Ark KR

### Lost Ark Open API

- Base URL [V]: `https://developer-lostark.game.onstove.com` (Swagger 2.0: `/swagger-doc/endpoints/news`,
  `/swagger-doc/endpoints/gamecontents`).
- Auth [V] (https://developer-lostark.game.onstove.com/getting-started): `authorization: bearer {JWT}`,
  `accept: application/json`. No token → 401 `{"Message":"Authorization has been denied for this request."}`.
- Rate limit [V]: 100 requests/minute per client; 429 until the quota resets. Headers `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset` (UNIX epoch seconds). No `Retry-After` documented.
- Maintenance [V]: every request returns 503 during maintenance (https://developer-lostark.game.onstove.com/usage-guide).
  The guide recommends caching; `/news/events` may need calling only once a day or week.
- Endpoints [V]:
  - `GET /news/notices?searchText=&type=` (type ∈ 공지|점검|상점|이벤트) → `[{Title, Date, Link, Type}]`
  - `GET /news/events` → `[{Title, Thumbnail, Link, StartDate, EndDate, RewardDate}]`
  - `GET /news/alarms` → `{RequirePolling, Alarms:[{AlarmType, Contents, StartDate, EndDate}]}`
  - `GET /gamecontents/calendar` → `[{CategoryName, ContentsName, ContentsIcon, MinItemLevel, StartTimes[], Location, RewardItems[]}]`
  - Date fields are typed date-time without a stated zone; commonly KST without offset; `RewardDate` may be null [U].

### Terms of use [V] (https://developer-lostark.game.onstove.com/agreement, effective 2022-09-29)

- Monetization/commercial exploitation requires the company's prior approval; ads/donations "may be allowed" after
  approval.
- "Storing any Content, including by printing, copying, modifying, or downloading them, or providing such stored
  materials to others, constitutes a violation of these Terms." — conflicts with the usage guide's caching advice.
  → **Needs written clarification** (developer-lostark@smilegate.com) before GAMEPULSE stores API data.
- No attribution clause found.

### Reset times [V] (official GameGuide pages)

- Daily: "매일 06시 획득 기회 초기화"; weekly: "매주 수요일 06시"
  (https://lostark.game.onstove.com/GameGuide/Pages/카제로스%20전장판 and the 에픽 레이드 / 어비스 레이드 / 아크 패스 guides).
  Time zone not printed; KST implied for the KR service.
- Regular maintenance usually Wednesday 06:00–10:00 but varies (e.g. notice 13547 vs 13555) → not modeled as a rule.

### robots.txt [V]

- https://lostark.game.onstove.com/robots.txt: `User-agent: * / Allow: /` (served with a UTF-8 BOM).
- developer-lostark.game.onstove.com has no robots.txt (302 to /notfound).
