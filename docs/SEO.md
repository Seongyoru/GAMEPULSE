# GAMEPULSE — SEO

GAMEPULSE pages must be useful on their own (structured facts, dates in Korean time, source links) and fast. Search
traffic lands on game pages and content detail pages; TODAY and MY GAMES turn visitors into returning users.

## URL structure

| Path                                                       | Content                                            | Indexed                                |
| ---------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `/`                                                        | Homepage: hero, live pulse, game snapshots         | yes                                    |
| `/today`                                                   | TODAY dashboard (anonymous defaults; personalized) | yes                                    |
| `/games`, `/games/[game]`                                  | Games index, game overview                         | yes                                    |
| `/games/[game]/patches\|events\|rewards\|resets\|calendar` | Game tabs                                          | yes, unless the game lacks the feature |
| `/patches/[slug]`                                          | Patches and updates                                | yes, unless synthetic                  |
| `/events/[slug]`                                           | Events and banners                                 | yes, unless synthetic                  |
| `/rewards/[slug]`                                          | Rewards and redeem codes                           | yes, unless synthetic                  |
| `/notices/[slug]`                                          | Maintenance and announcements                      | yes, unless synthetic or empty         |
| `/calendar`                                                | Unified calendar                                   | yes                                    |
| `/my-games`                                                | Local preference editor                            | no (`noindex`)                         |

- Every content type maps to exactly one URL family (`routeFamilyForType`); a slug requested under another family
  answers **308** to its canonical URL.
- Slugs are ASCII, derived from the game slug + type + version/slug hint, and **immutable** once published (the store
  keeps the original slug when a record is updated). Korean titles live in the page, not in the URL.
- Future locales get path prefixes (`/en/...`) with `hreflang` alternates; Korean URLs never change.

## Metadata

`pageMetadata()` (`apps/web/src/server/seo.ts`) produces for every page: title (`%s | GAMEPULSE` template),
description, canonical (`alternates.canonical`, resolved against `GAMEPULSE_SITE_URL`), OpenGraph and Twitter cards
(default 1200×630 image from `app/opengraph-image.tsx`), and `robots` when a page must not be indexed.

- `GAMEPULSE_SITE_URL` provides the canonical origin. **No production domain is hardcoded**; the default is
  `http://localhost:3000`.
- Content descriptions are the stored structured summary, prefixed with the game name, ≤ 160 characters.

## Indexing policy

- **Synthetic content is never indexed**: fixture records render `noindex` and are excluded from the sitemap.
- **Sample-data deployments are never crawled**: when the site serves fixtures (local, previews), the root layout sets
  `noindex, nofollow`, `robots.txt` disallows everything and the sitemap is empty.
- Thin pages (an announcement without a summary, a game tab for a feature the game does not have) are `noindex`.
- We store structured facts and short summaries — never copies of official articles — and every detail page links to
  the original source (see [LEGAL_NOTES.md](LEGAL_NOTES.md)).

## Structured data (JSON-LD)

| Page                         | Types                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| Homepage                     | `WebSite`                                                       |
| Games index, game tabs       | `BreadcrumbList` (+ `VideoGame` on the overview)                |
| Events, banners, maintenance | `BreadcrumbList`, `Event` (online, organizer = publisher)       |
| Patches, rewards, notices    | `BreadcrumbList`, `Article` (`isBasedOn` = official source URL) |

JSON-LD is serialized with `<` escaped so source text can never close the script element.

## Sitemap and robots

- `app/sitemap.ts` (revalidated hourly): static pages, every available game tab, and every non-synthetic content
  record with `lastModified = updatedAt`.
- `app/robots.ts`: allow all and point to the sitemap in production; disallow all in sample-data mode.

## Internal links

Breadcrumbs on detail pages (Home › Game › Tab › Item), game tabs, snapshot rows linking to the latest patch / ending
event / current banner, TODAY and calendar entries linking to detail pages, compensation and related-item links
between notices and rewards, and footer links to games and the calendar.

## Rendering and performance

- Static generation + ISR (`revalidate = 300`) for every public page; detail pages for the most recently updated 500
  records per family are prerendered at build time, the rest render on first request.
- Personalization is client-side over the static payload; an inline script applies MY GAMES before first paint, so
  there is no layout shift (CLS) from personalization. Countdowns render the absolute time on the server and switch to
  live values after hydration (stable markup).
- System font stacks (no web-font download), no client-side data fetching, no third-party scripts by default
  (analytics provider `none`, ads `off`). Ad slots reserve fixed height when enabled.
- Targets: LCP < 2.5 s, CLS < 0.1, INP < 200 ms on mobile. Lighthouse runs against `pnpm build && pnpm start` are
  tracked in [ROADMAP.md](ROADMAP.md) (Phase 5).
