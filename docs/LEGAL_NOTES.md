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
- **No copyrighted artwork** by default: the UI uses neutral, generated visuals (accent colours, initials).
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

## Manual ingestion of facts

Manual entries record facts (titles, dates, reward quantities) with a link to the official notice. Summaries are
written by GAMEPULSE in its own words and kept short. Redeem codes are only published with official evidence.

## Before production (checklist)

- [ ] Re-review every source's terms and robots policy; update `termsReviewedAt`.
- [ ] Riot product registration + production key; legal notice in the footer.
- [ ] Written answers from Smilegate (storage) and NEXON (storage, TTL, commercial use).
- [ ] NEXON: show "Data based on NEXON Open API" wherever MapleStory API data appears (cards included) and enforce
      the 30-day `dataRetentionDays` before enabling `maplestory-openapi`.
- [ ] Permission requests to HoYoverse/Kuro if automated collection is desired.
- [ ] Privacy policy and terms of service pages; cookie/analytics consent where required.
- [ ] Advertising policy review per publisher before enabling any ad slot.
- [ ] Human verification of reset schedules.
