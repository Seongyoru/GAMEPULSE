import {
  defaultFixturesDir,
  getAdapterDefinition,
  loadRecordedTransport,
} from '@gamepulse/collectors';
import { createTestAdapterContext, TEST_ANCHOR } from '@gamepulse/collectors/testing';
import { InMemoryContentStore } from '@gamepulse/database/memory';
import { noopLogger } from '@gamepulse/observability';
import { beforeEach, describe, expect, it } from 'vitest';
import { runIngestion } from './pipeline';
import { syncRegistry } from './seed';

const deps = (store: InMemoryContentStore) => ({
  store,
  logger: noopLogger,
  clock: () => TEST_ANCHOR,
});

function mockAdapter(adapterId: string) {
  const definition = getAdapterDefinition(adapterId);
  if (!definition) throw new Error(`unknown adapter ${adapterId}`);
  const context = createTestAdapterContext({
    mode: 'mock',
    transport: loadRecordedTransport(defaultFixturesDir()),
  });
  return definition.create(context);
}

describe('live adapters in mock mode through the full pipeline', () => {
  let store: InMemoryContentStore;

  beforeEach(async () => {
    store = new InMemoryContentStore();
    await syncRegistry(store, TEST_ANCHOR);
  });

  it('Lost Ark Open API: publishes synthetic records under the mock twin source, idempotently', async () => {
    const adapter = mockAdapter('lostark-openapi');
    const first = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(first.status).toBe('SUCCEEDED');
    expect(first.counters).toMatchObject({ discovered: 3, fetched: 3, new: 7, failed: 0 });

    const second = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(second.status).toBe('SUCCEEDED');
    expect(second.counters.new).toBe(0);
    expect(second.counters.updated).toBe(0);

    const records = await store.listContent({ gameIds: ['lostark'], order: 'start' });
    expect(records).toHaveLength(7);
    expect(records.every((record) => record.isSynthetic)).toBe(true);
    expect(records.every((record) => record.source.id === 'lostark-openapi-mock')).toBe(true);

    const reward = records.find((record) => record.type === 'REWARD');
    const event = records.find((record) => record.title === '[샘플] 가을 수확 출석 이벤트');
    expect(reward?.detail.type === 'REWARD' && reward.detail.relatedSlug).toBe(event?.slug);
    expect(event?.timing).toMatchObject({ sourceTimezone: 'Asia/Seoul', region: 'kr' });
  });

  it('Data Dragon: publishes one patch record with structured changes, idempotently', async () => {
    const adapter = mockAdapter('lol-ddragon');
    const first = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(first.status).toBe('SUCCEEDED');
    expect(first.counters).toMatchObject({ discovered: 1, fetched: 1, new: 1, failed: 0 });
    const second = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(second.counters).toMatchObject({ new: 0, updated: 0 });

    const [record] = await store.listContent({ gameIds: ['lol'], types: ['PATCH'] });
    expect(record?.slug).toBe('league-of-legends-patch-data-dragon-16-19-1');
    expect(record?.detail.type === 'PATCH' && record.detail.changes).toHaveLength(8);
    expect(record?.validationStatus).toBe('VALID');
  });

  it('MapleStory NEXON notices: events, updates, maintenance and notices', async () => {
    const report = await runIngestion(mockAdapter('maplestory-openapi'), deps(store), {
      trigger: 'TEST',
    });
    expect(report.status).toBe('SUCCEEDED');
    expect(report.counters).toMatchObject({ discovered: 3, new: 5, failed: 0 });
    const records = await store.listContent({ gameIds: ['maplestory'] });
    expect(records.map((record) => record.type).sort()).toEqual([
      'ANNOUNCEMENT',
      'EVENT',
      'EVENT',
      'MAINTENANCE',
      'UPDATE',
    ]);
    expect(
      records.every((record) => record.source.attribution === 'Data based on NEXON Open API'),
    ).toBe(true);
  });
});
