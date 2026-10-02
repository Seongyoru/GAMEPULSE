# GAMEPULSE — AI pipeline

AI is a **transformation layer**, never the source of truth.

```
official document ──► plain text ──► AIParser ──► AiExtraction (Zod) ──► NormalizedCandidate ──► validation ──► publish
                                       ▲  cache by (input hash, parser id, parser version)
```

## What AI may and may not do

| May                                                                 | May not                                 |
| ------------------------------------------------------------------- | --------------------------------------- |
| classify content, extract dates, identify rewards and patch targets | invent missing dates                    |
| summarize changes, translate short summaries                        | invent rewards or quantities            |
| identify urgency, normalize terminology                             | guess patch values                      |
|                                                                     | generate redeem codes                   |
|                                                                     | infer changes the source does not state |

Unknown values stay `null`.

## Contract

`packages/parsers/src/schema.ts` defines `aiExtractionSchema`: every item carries `kind`, `title`, normalized
`startAt`/`endAt` **and** the original `startAtSource`/`endAtSource`/`sourceTimezone`, typed details (rewards, code,
version, patch changes, featured units), `evidence: [{ field, excerpt }]` and a `confidence` in [0, 1].
Output that does not satisfy the schema is rejected before it reaches the pipeline.

```ts
interface AIParser {
  id: string; // "claude", "mock", "rule-based"
  version: string; // bump on any prompt/schema/logic change (invalidates the cache)
  kind: 'ai' | 'deterministic';
  parse(input: ParserInput): Promise<ParserOutput>;
}
```

Implementations:

| Parser            | Kind           | Use                                                                                             |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `RuleBasedParser` | deterministic  | official date-range formats with explicit zone labels (`(UTC+8)`, `(서버 시간)`, `(한국 시간)`) |
| `MockParser`      | ai (simulated) | **the only parser allowed in automated tests** — offline, free, deterministic                   |
| `ClaudeParser`    | ai             | Phase 4; structured output, evidence required; never called from tests                          |

Prefer deterministic parsers whenever they are simpler; use AI where it adds clear value (free-text event,
maintenance and patch notices, reward descriptions).

## Evidence and verification

The validation engine (`packages/validators`) treats `kind: 'ai'` output strictly:

- no evidence at all → `REVIEW` (never auto-published)
- `startAt`/`endAt` without a supporting excerpt → `REVIEW`
- an excerpt that does not occur in the source text (whitespace/Unicode-normalized) → `REVIEW`
- redeem codes always need an excerpt containing the code → otherwise `REVIEW`
- normalized times must match the source's own wording in its stated zone → otherwise `INVALID`

Confidence and verification are separate: e.g. _AI confidence 0.96 · official source · validation PASS ·
verification AUTO_VERIFIED_. `AUTO_VERIFIED` requires an official source and a passing validation.

## Cost controls

- Documents are hashed before parsing; unchanged documents are never re-parsed.
- `CachedParser` stores results keyed by input hash + parser id + version (`parse_results`), so retries and
  re-ingestion do not repeat paid calls.
- AI is opt-in per adapter (`AI_PARSER`, `ANTHROPIC_API_KEY`); without a key the system runs on deterministic parsers.
- Tests use `MockParser` only; CI has no AI credentials.
