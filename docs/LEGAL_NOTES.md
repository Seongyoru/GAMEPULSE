# GAMEPULSE — Legal and source-safety notes

> Engineering notes, not legal advice. Items marked **needs review** require a human/legal decision before production.

## Rules the codebase enforces

- **No indiscriminate scraping.** A website collector may run only when its source is `ENABLED` after a terms and
  robots.txt review. The HTTP client checks robots.txt, identifies GAMEPULSE in its User-Agent (with a contact via
  `COLLECTOR_CONTACT`), rate-limits per host, honours `Retry-After`/`X-RateLimit-*`, and stops at anti-bot challenges.
- **Never bypass** anti-bot measures, authentication, paywalls or rate limits.
- **Facts, not copies.** GAMEPULSE stores structured facts (dates, rewards, values) and short summaries. Full articles
  are never republished. Raw document text is kept only as an internal processing copy, never rendered, and pruned
  after `RAW_TEXT_RETENTION_DAYS` (default 30) — sources may require shorter retention (`dataRetentionDays`).
- **Always link the original source** and show who published it.
- **No publisher artwork or logos.** Every game gets original key art drawn in code (an abstract motif in its colour)
  and a title card set in our own typography (D-036). Official logos, key art or character images may only be added
  with the publisher's permission (ask together with the data-use requests).
- **Open-licensed type and icons.** Space Grotesk and Black Han Sans are SIL OFL 1.1 (neither declares a Reserved Font
  Name, so the subset keeps its name); the committed Black Han Sans subset carries its licence in
  `apps/web/src/app/fonts/title-subset.OFL.txt`. Icons come from lucide-react (ISC).
- **Synthetic data is labelled** and synthetic codes start with `GPTEST-`.

## Per-publisher findings (2026-10-02)

### Riot Games — League of Legends

- Products serving players must be **registered** with Riot; production API keys require a verified website.
  Development keys cannot power a public product. (**needs action** before production)
- Required notice (display where players can readily see it, e.g. the footer):
  > GAMEPULSE isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially
  > involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks
  > or registered trademarks of Riot Games, Inc.
- No Riot trademarks in the product/domain name or as search keywords.
- Riot ToS prohibits bots/scraping of Riot services (websites included) → patch notes are entered manually; Data
  Dragon and documented APIs are used for automation.
- Monetization (ads) requires an approved registration and a free tier.

### Smilegate — Lost Ark Open API

- Commercial exploitation (including ads/donations) needs **prior approval**. (**needs review** before ads)
- "Storing any Content … constitutes a violation of these Terms" conflicts with the usage guide's caching advice.
  **Needs written clarification** (developer-lostark@smilegate.com) before storing API data → collector held at
  `PENDING_REVIEW`.

### NEXON — MapleStory (NEXON Open API)

- Attribution **"Data based on NEXON Open API"** must be displayed with API data.
- Korean terms: no storing/processing/distributing result data beyond the terms without consent; no commercial use
  without consent. English terms: 30-day data TTL, no advertising use of the data, no scraping.
  Which version binds a Korean developer is unclear → build to the stricter set. (**needs review**)
- NEXON integrated terms prohibit commercially using obtained information without consent → no website scraping.

### HoYoverse — Genshin Impact

- ToS §7(c): services/content may not be "scraped" or republished without express written permission; §3(vi) no
  commercial purpose. → collectors `DISABLED`; manual ingestion of facts with links. To request permission:
  주식회사 코그노스피어코리아 (kr_mkt_global@hoyoverse.com).

### Kuro Games — Wuthering Waves

- Terms §2(4): content may not be downloaded, copied, displayed or exploited without prior written consent; licence
  is non-commercial. → collectors `DISABLED`; manual ingestion. Contact: 쿠로게임즈코리아 (wutheringwaves_krsupport@kurogames.com).

### HoYoverse — Zenless Zone Zero (registered, hidden)

- Same position as Genshin Impact: ToS §7(c) prohibits content being "scraped" without written permission; the Korean
  이용약관 제8조 8) and 제28조 2) prohibit copying obtained information for other purposes and commercial reuse.
  → collector `DISABLED`; manual ingestion of facts with links. One permission request to HoYoverse can cover both
  games (주식회사 코그노스피어코리아, kr_mkt_global@hoyoverse.com).

### Perfect World — Neverness to Everness (researched, not registered)

- EN ToS (effective 2026-07-08) §3.4(s) bans robots, spiders and crawlers that monitor or copy information **"or any
  manual process to do the same"**; §6.1(b) bans commercial use, public display and data mining; the Korean 이용약관
  제4조② bans copying/transmitting/displaying content without authorisation.
  → no collector, and **no manual ingestion before written permission or legal review** (nte.legal@perfectworld.com
  or the Korean agent named in the 이용약관, 주식회사 퍼펙트월드코리아).

## Manual ingestion of facts

Manual entries record facts (titles, dates, reward quantities) with a link to the official notice. Summaries are
written by GAMEPULSE in its own words and kept short. Redeem codes are only published with official evidence.

## AI processing

- Only official, public announcement text is sent to the Anthropic API (server-side key; no user data, no MY GAMES
  data). AI output is structured facts plus at most two-sentence summaries; evidence excerpts are short and used for
  verification only.
- `ingest:text` input is text an operator read on an official page; it is stored as a raw document for at most
  `RAW_TEXT_RETENTION_DAYS` and never rendered.

## Before production (checklist)

- [ ] Re-review every source's terms and robots policy; update `termsReviewedAt`.
- Takedown readiness: if a publisher objects, set the game to `INACTIVE` (hidden everywhere, collection stops; D-035)
  or set the source's `collectorStatus` to `DISABLED`, then redeploy.
- [ ] Riot product registration + production key; legal notice in the footer.
- [ ] Written answers from Smilegate (storage) and NEXON (storage, TTL, commercial use).
- [x] NEXON: show "Data based on NEXON Open API" wherever MapleStory API data appears — detail pages, cards and
      compact views (calendar, timeline, game snapshots) render the source's attribution (D-034). The 30-day
      `dataRetentionDays` is enforced by the maintenance job (D-031).
- [ ] Legal review of `/privacy`, `/terms` and `/sources` (drafts describing current behaviour).
- [ ] Permission requests to HoYoverse (Genshin Impact and Zenless Zone Zero together) and Kuro if automated
      collection is desired; to Perfect World before Neverness to Everness is added at all.
- [ ] Privacy policy and terms of service pages; cookie/analytics consent where required.
- [ ] Advertising policy review per publisher before enabling any ad slot.
- [ ] Human verification of reset schedules.
