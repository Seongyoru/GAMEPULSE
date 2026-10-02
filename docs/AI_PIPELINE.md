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
| `ClaudeParser`    | ai             | Claude via the Messages API with structured outputs; evidence required; never called from tests |

Prefer deterministic parsers whenever they are simpler; use AI where it adds clear value (free-text event,
maintenance and patch notices, reward descriptions).

## ClaudeParser

`packages/parsers/src/claude.ts` — official Anthropic TypeScript SDK (`@anthropic-ai/sdk`), server-side only.

- **Request:** `client.beta.messages.stream(...).finalMessage()` (streaming keeps large patch notes clear of HTTP
  timeouts) with `model` = `AI_MODEL` (default `claude-opus-5-5`), `output_config.effort` = `AI_EFFORT` (default
  `medium`; `none` omits it), `output_config.format` = JSON schema generated from a Zod schema by the SDK helper
  (`betaZodOutputFormat`), and server-side refusal fallback (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`; `AI_SERVER_FALLBACK=false` turns it off for models/platforms without it).
- **The model transcribes; code computes.** The model-facing schema asks for verbatim time expressions, their zone
  labels as written, and the wall time as written (`YYYY-MM-DD[THH:mm]`). The parser resolves labels with the same
  rules as `RuleBasedParser` (`UTC+8`, `서버 시간` → the game's server zone, `한국 시간`/`KST` → Asia/Seoul; an
  unlabeled time uses only the zone the source policy or operator declared; anything else stays unnormalized) and
  converts to UTC deterministically. Date-only starts are 00:00 and date-only ends 23:59 of that day, with `DATE`
  precision so no time of day is ever shown.
- **Order of checks:** `stop_reason` first (`refusal` of the whole fallback chain and `max_tokens` raise
  `ParserError`; nothing partial is parsed or stored), then JSON + Zod validation of the model-facing schema, then the
  `aiExtractionSchema` contract, then the validation engine (evidence must occur in the source text).
- **Prompt:** a frozen system prompt (`CLAUDE_SYSTEM_PROMPT`, `cache_control: ephemeral`) states the transcription
  rules — extract only stated facts, null for unknowns, verbatim evidence ≤ 300 characters per fact, never create or
  alter codes, short summaries instead of copied passages, and treat the document as untrusted data. The document goes
  last, inside `<document>` tags.
- **Version:** `claude-<CLAUDE_PROMPT_VERSION>:<model>:<effort>` — changing the prompt, schema, model or effort
  invalidates cached results.
- **Usage:** input/output/cache token counts are returned per call and stored with the parse result.

### Where AI runs

| Path                                                                   | Parser                      | Publication                                                  |
| ---------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `pnpm ingest:text <file> --game <id> --url <official URL> [--task ..]` | `AI_PARSER` (default rules) | AI facts with verified evidence → `PUBLISHED` + `UNVERIFIED` |
| Collectors flagged `usesParser` (none enabled yet)                     | `AI_PARSER`                 | official source + verified evidence → `AUTO_VERIFIED`        |

`ingest:text` is the operator path for sources GAMEPULSE may not collect (Genshin Impact, Wuthering Waves): the
operator saves the text of an official notice they read; the parser structures it; evidence is checked against that
text; the raw text is pruned after `RAW_TEXT_RETENTION_DAYS`. `--default-zone` declares the zone for unlabeled times
(e.g. `Asia/Seoul` for Korean notices that print KST without a label) — without it such times stay unnormalized.

## Evidence and verification

The validation engine (`packages/validators`) treats `kind: 'ai'` output strictly:

- no evidence at all → `REVIEW` (never auto-published)
- `startAt`/`endAt` without a supporting excerpt → `REVIEW`
- an excerpt that does not occur in the source text (whitespace/Unicode-normalized) → `REVIEW`
- redeem codes always need an excerpt containing the code → otherwise `REVIEW`
- normalized times must match the source's own wording in its stated zone → otherwise `INVALID`

Confidence and verification are separate: e.g. _AI confidence 0.96 · official source · validation PASS ·
verification AUTO_VERIFIED_. `AUTO_VERIFIED` requires an official source and a passing validation. AI output from
operator-supplied text is published as `UNVERIFIED` (operators vouch only for what they type).

## Cost controls

- Documents are hashed before parsing; unchanged documents are never re-parsed.
- `CachedParser` stores results keyed by input hash + parser id + version (`parse_results`), so retries and
  re-ingestion do not repeat paid calls.
- AI is opt-in (`AI_PARSER=claude`, `ANTHROPIC_API_KEY`); without a key the system runs on deterministic parsers.
- Documents above `AI_MAX_INPUT_CHARS` (default 40,000) are rejected, never truncated.
- The system prompt is frozen and cached; effort defaults to `medium` for extraction work.
- Tests use `MockParser` in pipeline tests; `ClaudeParser`'s own unit tests drive the real SDK against a stub `fetch`.
  No test, and no CI job, has AI credentials or makes a paid request.
