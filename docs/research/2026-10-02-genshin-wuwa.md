# Source research — Genshin Impact (HoYoverse) and Wuthering Waves (Kuro Games)

- **Date:** 2026-10-02
- **Method:** ~90 polite requests (≈1 s apart), no logins. Official pages and the JSON those pages load.
- **Labels:** **VERIFIED** seen on an official page or in the JSON an official page loads · **INFERRED** derived
  from verified data · **UNVERIFIED** not confirmed.
- **Status:** research input for `docs/DATA_SOURCES.md` / `docs/LEGAL_NOTES.md`. Not legal advice.

## Key conclusions

1. **No documented public API, RSS or Atom feed exists for either game** (VERIFIED by absence). The news pages are
   built client-side from undocumented JSON.
2. **robots.txt does not restrict crawling** (game sites: 404 or no Disallow lines; HoYoLAB disallows `/genshin`).
3. **The terms are the binding limit.** HoYoverse's terms explicitly prohibit content being "scraped"; Kuro's terms
   forbid downloading/copying/displaying content without prior written consent; both limit commercial use.
   → **Automated collection is not permitted by default.** It needs written permission or legal sign-off.
   Korean domestic agents named in the Korean terms:
   - Genshin: 주식회사 코그노스피어코리아, kr_mkt_global@hoyoverse.com
   - Wuthering Waves: 쿠로게임즈코리아 유한회사, wutheringwaves_krsupport@kurogames.com
4. **Korean notices usually state KST (often unlabeled)**, i.e. Asia server time (UTC+8) + 1 hour; English notices use
   "(server time)" or "(UTC+8)". Labels must be parsed explicitly and both values preserved.

## 1. Genshin Impact (COGNOSPHERE PTE. LTD.)

- Korean news (VERIFIED): https://genshin.hoyoverse.com/ko/news — category pages `/ko/news/{channelId}`
  (395 최신, 396 소식, 397 공지사항, 398 이벤트), details `/ko/news/detail/{id}`.
- HoYoLAB official feed (VERIFIED): https://www.hoyolab.com/circles/2/27/official?page_type=27&page_sort=notices
- Terms (VERIFIED):
  - English ToS (updated 2026-05-20, https://genshin.hoyoverse.com/en/company/terms) §7(c): the Services "may not be
    modified, copied, distributed, framed, reproduced, republished, downloaded, scraped, displayed, posted,
    transmitted, or sold … without COGNOSPHERE's express prior written permission"; §3(vi) no commercial purpose.
  - Korean 이용약관 (시행 2026-08-12, https://genshin.hoyoverse.com/ko/company/terms) 제8조 7)·8), 제28조.
- Undocumented website-internal JSON exists (`sg-public-api-static.hoyoverse.com/content_v2_user/...`) — **not used**
  (no licence; terms prohibit scraping).
- Servers (VERIFIED): America, Europe, Asia, TW/HK/MO. Offsets UTC-5 / UTC+1 / UTC+8 / UTC+8 (UNVERIFIED).
- Version maintenance announced in UTC+8: "2026/09/23 06:00 (UTC+8) 시작" (VERIFIED).
- Daily reset 04:00 server time (INFERRED from 03:59 window ends). Weekly Monday 04:00 (UNVERIFIED).
- Spiral Abyss refreshes on the **16th of each month** (VERIFIED; time of day UNVERIFIED).
- Imaginarium Theater opens on the **1st of each month** (VERIFIED; time of day UNVERIFIED).
- Redeem codes: web redemption page https://genshin.hoyoverse.com/ko/gift (VERIFIED, login required). The site
  publishes no code list; codes are typically released in livestreams/social channels (UNVERIFIED).
- Announcement format: Korean "콘텐츠 개방 기간: 2026/09/30 11:00 ~ 2026/11/03 04:59" (no zone label) equals English
  "2026/09/30 10:00 - 2026/11/03 03:59" (server time) → Korean times are KST (INFERRED).
- Current version (VERIFIED): 7.1, updated 2026-09-23 06:00 UTC+8.

## 2. Wuthering Waves (Kuro Games)

- Korean news (VERIFIED): https://wutheringwaves.kurogames.com/kr/main/news/ (locale code `kr`; `/ko/` serves
  English). Tabs 최신 정보 / 공지 / 뉴스 / 이벤트. The Korean site has fewer articles than English (380 vs 701).
- robots.txt (VERIFIED): `User-agent: *` only.
- Terms (VERIFIED):
  - English Terms of Use (effective 2025-09-29) §2(4): content "may not be downloaded, copied, reproduced,
    distributed, transferred, broadcast, displayed, sold, licensed or otherwise exploited for any purpose whatsoever
    without our … prior written consent"; §3(1) licence is for non-commercial use.
  - Korean 이용약관 (effective 2026-07-23) 제14조② no commercial use of IP without consent; 제10조①(6) no circumventing
    technical measures.
- Undocumented website JSON exists (`hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/...`) —
  **not used**.
- Servers (VERIFIED): Asia (incl. Korea), America, Europe, SEA, HMT. Offsets UNVERIFIED.
- Maintenance announced in UTC+8: "2026-09-30 04:00 - 2026-09-30 11:00 (UTC+8)" (VERIFIED).
- Daily reset 04:00 server time (VERIFIED: "Sign-in records refresh daily at 04:00 server time", 3.7 patch notes).
  Weekly Monday 04:00 (UNVERIFIED). Tower of Adversity cadence (UNVERIFIED).
- Convene notice formats (VERIFIED): English "Version 3.7 update - 2026-10-22 09:59 (server time)"; Korean
  "2026년 7월 30일 11:00 ~ 2026년 8월 19일 12:59 (한국 시간)". One Korean notice said "매일 서버 시간 05:00" while English
  said 04:00 server time — **Korean labels cannot be trusted blindly**.
- Redeem codes: no official web redemption page or code list (VERIFIED by absence).
- Current version (VERIFIED): 3.7, released 2026-09-30 (UTC+8).

## 3. Time-zone modelling advice

- Store UTC instants; keep the source's own value and zone (`timing.startAtSource`, `timing.sourceTimezone`).
- Detect "(UTC+8)", "(server time)", "(서버 시간)", "(한국 시간)". Treat unlabeled Korean times as KST only with
  corroboration (e.g. the English version of the same notice).
- For Korean users on the Asia server: server time = UTC+8 = KST − 1 hour.
- "After the version update" should anchor to the end of maintenance, which varies per version → never guess;
  keep `startAt` null with `startAtSource` preserved until the time is known.
