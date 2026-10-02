import { describe, expect, it } from 'vitest';
import { CachedParser, parserInputHash, type ParseCacheStore } from './cache';
import { htmlToText } from './html';
import { MockParser } from './mock';
import { extractDateRange, resolveZoneLabel, RuleBasedParser } from './rule-based';
import { emptyExtractionItem, extractionToCandidates, type AiExtraction } from './schema';
import type { ParserInput } from './types';

function input(text: string, overrides: Partial<ParserInput> = {}): ParserInput {
  return {
    task: 'EVENT',
    gameId: 'genshin',
    sourceUrl: 'https://genshin.hoyoverse.com/ko/news/detail/1',
    sourceLocale: 'ko-KR',
    text,
    title: '합성 이벤트',
    publishedAt: null,
    defaultTimezone: null,
    serverTimezone: 'UTC+8',
    ...overrides,
  };
}

describe('RuleBasedParser', () => {
  it('extracts an explicit UTC+8 range', () => {
    const item = extractDateRange(
      input('이벤트 기간: 2026/09/30 10:00 ~ 2026/11/03 03:59 (UTC+8)'),
    );
    expect(item).toMatchObject({
      startAt: '2026-09-30T02:00:00.000Z',
      endAt: '2026-11-02T19:59:00.000Z',
      sourceTimezone: 'UTC+8',
      startAtSource: '2026/09/30 10:00 (UTC+8)',
      confidence: 0.9,
    });
    expect(item?.evidence.map((e) => e.field)).toEqual(['startAt', 'endAt']);
  });

  it('maps Korean time labels and server time', () => {
    const kst = extractDateRange(
      input('2026년 7월 30일 11:00 ~ 2026년 8월 19일 12:59 (한국 시간)'),
    );
    expect(kst).toMatchObject({
      sourceTimezone: 'Asia/Seoul',
      startAt: '2026-07-30T02:00:00.000Z',
    });
    const server = extractDateRange(
      input('Version 3.7 - 2026-10-01 10:00 - 2026-10-22 09:59 (server time)'),
    );
    expect(server).toMatchObject({ sourceTimezone: 'UTC+8', endAt: '2026-10-22T01:59:00.000Z' });
  });

  it('handles same-day maintenance windows with the source default zone', () => {
    const item = extractDateRange(
      input('점검 시간: 2026년 9월 30일 (수) 05:00 ~ 12:00', {
        task: 'MAINTENANCE',
        defaultTimezone: 'Asia/Seoul',
      }),
    );
    expect(item).toMatchObject({
      kind: 'MAINTENANCE',
      startAt: '2026-09-29T20:00:00.000Z',
      endAt: '2026-09-30T03:00:00.000Z',
      sourceTimezone: 'Asia/Seoul',
    });
  });

  it('never guesses a zone for unlabeled times without a declared default', () => {
    const item = extractDateRange(input('2026/09/30 10:00 ~ 2026/11/03 03:59'));
    expect(item).toMatchObject({
      startAt: null,
      endAt: null,
      sourceTimezone: null,
      confidence: 0.3,
    });
    expect(item?.startAtSource).toBe('2026/09/30 10:00');
  });

  it('returns nothing when no range is present', async () => {
    const parser = new RuleBasedParser();
    expect((await parser.parse(input('버전 업데이트 후 ~ 종료 시까지'))).extraction.items).toEqual(
      [],
    );
    expect(parser.kind).toBe('deterministic');
  });

  it('resolves zone labels', () => {
    const zones = { defaultTimezone: null, serverTimezone: 'UTC+8' };
    expect(resolveZoneLabel('UTC+08:00', zones)).toBe('UTC+08:00');
    expect(resolveZoneLabel('GMT-5', zones)).toBe('UTC-5');
    expect(resolveZoneLabel('서버 시간', zones)).toBe('UTC+8');
    expect(resolveZoneLabel('KST', zones)).toBe('Asia/Seoul');
    expect(resolveZoneLabel('사이트 기준', zones)).toBeNull();
  });
});

describe('extractionToCandidates', () => {
  const context = {
    gameId: 'genshin',
    sourceUrl: 'https://genshin.hoyoverse.com/ko/news/detail/1',
    sourceLocale: 'ko-KR',
    sourcePublishedAt: '2026-09-29T02:00:00Z',
    sourceKeyPrefix: 'news-1',
    region: 'asia',
  };

  it('maps items and drops those that cannot form candidates', () => {
    const extraction: AiExtraction = {
      items: [
        {
          ...emptyExtractionItem('EVENT', '이벤트'),
          startAt: '2026-10-01T02:00:00Z',
          confidence: 0.8,
        },
        emptyExtractionItem('PATCH', '버전 없음'),
        emptyExtractionItem('REDEEM_CODE', '코드 없음'),
      ],
    };
    const { candidates, dropped } = extractionToCandidates(extraction, context);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: 'EVENT',
      sourceKey: 'news-1#0',
      confidence: 0.8,
      isSynthetic: false,
    });
    expect(dropped).toHaveLength(2);
  });
});

describe('MockParser and CachedParser', () => {
  it('validates mock output and caches by input hash', async () => {
    const mock = new MockParser(() => ({
      items: [{ ...emptyExtractionItem('EVENT', 'x'), confidence: 1 }],
    }));
    const saved = new Map<string, unknown>();
    const cache: ParseCacheStore = {
      find: (hash, id, version) => {
        const output = saved.get(`${hash}|${id}|${version}`);
        return Promise.resolve(output === undefined ? null : { output: output as never });
      },
      save: (entry) => {
        saved.set(`${entry.inputHash}|${entry.parserId}|${entry.parserVersion}`, entry.output);
        return Promise.resolve();
      },
    };
    const cached = new CachedParser(mock, cache);
    const first = await cached.parse(input('text'));
    const second = await cached.parse(input('text'));
    expect(first.extraction).toEqual(second.extraction);
    expect(mock.calls).toHaveLength(1);
    expect(parserInputHash(input('text'))).not.toBe(parserInputHash(input('other')));
  });

  it('rejects malformed mock output', async () => {
    const bad = new MockParser(() => ({ items: [{ kind: 'EVENT' }] }) as unknown as AiExtraction);
    await expect(bad.parse(input('x'))).rejects.toThrow();
  });
});

describe('htmlToText', () => {
  it('keeps block structure and drops scripts', () => {
    expect(
      htmlToText(
        '<h1>공지</h1><p>기간: 10/08&nbsp;10:00</p><script>alert(1)</script><ul><li>A</li><li>B</li></ul>',
      ),
    ).toBe('공지\n기간: 10/08 10:00\nA\nB');
  });
});
