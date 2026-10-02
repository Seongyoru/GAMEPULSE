import { manualSourceFor, MAPLESTORY_OPENAPI_SOURCE } from '@gamepulse/collectors';
import { InMemoryContentStore } from '@gamepulse/database/memory';
import { requireGame, semanticKey, type PublishInput } from '@gamepulse/domain';
import { makeCandidate } from '@gamepulse/domain/testing';
import { describe, expect, it } from 'vitest';
import { runMaintenance } from './maintenance';

const publish = (
  input: Pick<PublishInput, 'candidate' | 'source' | 'now' | 'slug'>,
): PublishInput => ({
  ...input,
  semanticKey: semanticKey(input.candidate),
  contentHash: input.slug,
  status: 'PUBLISHED',
  verification: 'AUTO_VERIFIED',
  verifiedAt: null,
  validationStatus: 'VALID',
  parser: { id: 'test', version: '1' },
  rawDocumentId: null,
  supersedeId: null,
});

describe('runMaintenance', () => {
  it('enforces source TTLs and leaves sources without one untouched', async () => {
    const store = new InMemoryContentStore();
    const manual = manualSourceFor(requireGame('maplestory'));
    await store.syncSources([MAPLESTORY_OPENAPI_SOURCE, manual], '2026-08-01T00:00:00.000Z');
    const old = '2026-08-15T00:00:00.000Z';
    await store.publishContent(
      publish({
        candidate: makeCandidate('EVENT', {
          gameId: 'maplestory',
          sourceKey: 'event:1',
          sourceUrl: 'https://maplestory.nexon.com/News/Event',
        }),
        source: MAPLESTORY_OPENAPI_SOURCE,
        now: old,
        slug: 'maplestory-event-1',
      }),
    );
    await store.publishContent(
      publish({
        candidate: makeCandidate('EVENT', {
          gameId: 'maplestory',
          sourceKey: 'manual-1',
          title: '수동 입력',
          sourceUrl: 'https://maplestory.nexon.com/News/Event',
        }),
        source: manual,
        now: old,
        slug: 'maplestory-manual-1',
      }),
    );

    const report = await runMaintenance(store, {
      rawTextRetentionDays: 30,
      now: new Date('2026-10-02T00:00:00Z'),
    });
    expect(report.expired.find((entry) => entry.sourceId === 'maplestory-openapi')).toMatchObject({
      retentionDays: 30,
      content: 1,
    });
    expect(await store.getContentBySlug('maplestory-event-1')).toBeNull();
    expect(await store.getContentBySlug('maplestory-manual-1')).not.toBeNull();
  });
});
