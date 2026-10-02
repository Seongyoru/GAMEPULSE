import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ManualInputError, ManualTextAdapter } from '@gamepulse/collectors';
import { TEST_ANCHOR } from '@gamepulse/collectors/testing';
import { InMemoryContentStore } from '@gamepulse/database/memory';
import {
  MockParser,
  RuleBasedParser,
  emptyExtractionItem,
  type AIParser,
} from '@gamepulse/parsers';
import { noopLogger } from '@gamepulse/observability';
import { beforeEach, describe, expect, it } from 'vitest';
import { runIngestion } from './pipeline';
import { syncRegistry } from './seed';

const NOTICE_URL = 'https://genshin.hoyoverse.com/ko/news';
const NOTICE = `「별빛 퍼즐」 웹 이벤트
이벤트 기간: 2026/10/01 10:00 ~ 2026/10/20 03:59 (UTC+8)
참여 보상: 원석 ×120`;

async function noticeFile(text = NOTICE): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gamepulse-text-'));
  const file = join(dir, 'notice.txt');
  await writeFile(file, text, 'utf8');
  return file;
}

function adapter(file: string, parser: AIParser) {
  return new ManualTextAdapter({
    gameId: 'genshin',
    filePath: file,
    url: NOTICE_URL,
    task: 'EVENT',
    title: '「별빛 퍼즐」 웹 이벤트',
    parser,
    clock: () => TEST_ANCHOR,
  });
}

/** A MockParser standing in for Claude: same contract, no API call. */
function mockAi(evidenceExcerpt: string) {
  return new MockParser(() => {
    const item = emptyExtractionItem('EVENT', '「별빛 퍼즐」 웹 이벤트');
    item.startAt = '2026-10-01T02:00:00.000Z';
    item.endAt = '2026-10-19T19:59:00.000Z';
    item.startAtSource = '2026/10/01 10:00 (UTC+8)';
    item.endAtSource = '2026/10/20 03:59 (UTC+8)';
    item.sourceTimezone = 'UTC+8';
    item.datePrecision = 'DATETIME';
    item.rewards = [{ name: '원석', quantity: 120, unit: null }];
    item.evidence = [
      { field: 'startAt', excerpt: evidenceExcerpt },
      { field: 'endAt', excerpt: evidenceExcerpt },
    ];
    item.confidence = 0.95;
    return { items: [item] };
  });
}

describe('manual text ingestion', () => {
  let store: InMemoryContentStore;
  const deps = () => ({ store, logger: noopLogger, clock: () => TEST_ANCHOR });

  beforeEach(async () => {
    store = new InMemoryContentStore();
    await syncRegistry(store, TEST_ANCHOR);
  });

  it('publishes evidence-backed AI extractions as unverified facts', async () => {
    const parser = mockAi('2026/10/01 10:00 ~ 2026/10/20 03:59 (UTC+8)');
    const report = await runIngestion(adapter(await noticeFile(), parser), deps(), {
      trigger: 'MANUAL',
    });
    expect(report.status).toBe('SUCCEEDED');
    expect(report.counters.new).toBe(1);
    expect(parser.calls[0]).toMatchObject({
      task: 'EVENT',
      serverTimezone: 'UTC+8',
      defaultTimezone: null,
    });

    const [record] = await store.listContent({ gameIds: ['genshin'] });
    expect(record).toMatchObject({
      type: 'EVENT',
      status: 'PUBLISHED',
      verification: 'UNVERIFIED',
      isSynthetic: false,
      startAt: '2026-10-01T02:00:00.000Z',
      parser: { id: 'mock' },
      source: { id: 'genshin-manual', url: NOTICE_URL },
    });
  });

  it('holds AI extractions whose evidence is not in the text for review', async () => {
    const parser = mockAi('2026/10/02 10:00 ~ 2026/10/30 03:59 (UTC+8)');
    const report = await runIngestion(adapter(await noticeFile(), parser), deps(), {
      trigger: 'MANUAL',
    });
    expect(report.status).toBe('SUCCEEDED');
    expect(await store.listContent({ gameIds: ['genshin'] })).toEqual([]);
    const held = await store.listContent({ gameIds: ['genshin'], statuses: ['PENDING_REVIEW'] });
    expect(held).toHaveLength(1);
  });

  it('uses the deterministic parser by default and marks operator input as verified', async () => {
    const report = await runIngestion(adapter(await noticeFile(), new RuleBasedParser()), deps(), {
      trigger: 'MANUAL',
    });
    expect(report.counters.new).toBe(1);
    const [record] = await store.listContent({ gameIds: ['genshin'] });
    expect(record).toMatchObject({
      verification: 'MANUAL_VERIFIED',
      startAt: '2026-10-01T02:00:00.000Z',
      endAt: '2026-10-19T19:59:00.000Z',
    });
  });

  it('only accepts official notice URLs', async () => {
    const file = await noticeFile();
    expect(
      () =>
        new ManualTextAdapter({
          gameId: 'genshin',
          filePath: file,
          url: 'https://example.com/leak',
          parser: new RuleBasedParser(),
          clock: () => TEST_ANCHOR,
        }),
    ).toThrow(ManualInputError);
  });
});
