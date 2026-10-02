/**
 * PostgreSQL ContentStore (Drizzle). Works with any Drizzle pg driver (postgres-js in
 * production, PGlite in tests). Behaviour is contract-tested against InMemoryContentStore.
 */
import { randomUUID } from 'node:crypto';
import {
  POINT_IN_TIME_TYPES,
  slugWithSuffix,
  stableStringify,
  type ContentDetail,
  type ContentQuery,
  type ContentRecord,
  type ContentSlugEntry,
  type ContentStore,
  type ExistingContentRef,
  type FinishRunInput,
  type GameConfig,
  type IngestionRunRecord,
  type JsonValue,
  type NormalizedCandidate,
  type ParseResultInput,
  type ProvenanceInput,
  type PublishInput,
  type PublishOutcome,
  type RawDocumentInput,
  type ResetRuleDefinition,
  type SourceDefinition,
  type StartRunInput,
  type StoredRawDocument,
  type SyncCounts,
  type ValidationResultInput,
} from '@gamepulse/domain';
import { and, asc, desc, eq, inArray, lt, max, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../client';
import { contentIdFor, featuredEntityType, sourceSummaryOf, toIso } from '../mapping';
import {
  bannerFeatured,
  banners,
  contentItems,
  contentSources,
  events,
  gameEntities,
  games,
  ingestionRuns,
  localizations,
  maintenances,
  parseResults,
  patchChanges,
  patches,
  rawDocuments,
  redeemCodes,
  resetRules,
  rewardItems,
  rewards,
  sources,
  validationResults,
  type GameConfigSnapshot,
} from '../schema';

type ContentRow = typeof contentItems.$inferSelect;
type RunRow = typeof ingestionRuns.$inferSelect;

const dateOrNull = (value: string | null): Date | null => (value === null ? null : new Date(value));
const isoOrNull = (value: Date | null): string | null => (value === null ? null : value.toISOString());
const pairKey = (a: string, b: string) => `${a}\u0000${b}`;

function outcomeCounts(outcomes: Array<'created' | 'updated' | 'unchanged'>): SyncCounts {
  return {
    created: outcomes.filter((o) => o === 'created').length,
    updated: outcomes.filter((o) => o === 'updated').length,
    unchanged: outcomes.filter((o) => o === 'unchanged').length,
  };
}

function toRun(row: RunRow): IngestionRunRecord {
  return {
    id: row.id,
    adapterId: row.adapterId,
    sourceId: row.sourceId,
    gameId: row.gameId,
    trigger: row.trigger,
    mode: row.mode,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: isoOrNull(row.finishedAt),
    counters: {
      discovered: row.discovered,
      fetched: row.fetched,
      new: row.newCount,
      updated: row.updatedCount,
      unchanged: row.unchanged,
      failed: row.failed,
      skipped: row.skipped,
    },
    error: row.error,
  };
}

export class PostgresContentStore implements ContentStore {
  constructor(private readonly db: Database) {}

  // ── registry sync ──────────────────────────────────────────────────────────

  private async upsertLocalization(
    db: Database,
    entry: { entityKind: string; entityId: string; locale: string; field: string; value: string; origin: 'SOURCE' | 'HUMAN' | 'MACHINE' },
    now: Date,
  ): Promise<void> {
    await db
      .insert(localizations)
      .values({ ...entry, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [localizations.entityKind, localizations.entityId, localizations.locale, localizations.field],
        set: { value: entry.value, origin: entry.origin, updatedAt: now },
      });
  }

  async syncGames(input: readonly GameConfig[], nowIso: string): Promise<SyncCounts> {
    const now = new Date(nowIso);
    const existing = new Map((await this.db.select().from(games)).map((row) => [row.id, row]));
    const outcomes: Array<'created' | 'updated' | 'unchanged'> = [];
    for (const game of input) {
      const config: GameConfigSnapshot = {
        regions: game.regions.map((region) => ({ id: region.id, timezone: region.timezone, isDefault: region.isDefault })),
        features: { ...game.features },
        adapters: [...game.adapters],
        accent: game.accent,
        sortOrder: game.sortOrder,
      };
      const values = {
        id: game.gameId,
        slug: game.slug,
        name: game.name,
        publisher: game.publisher,
        developer: game.developer,
        defaultTimezone: game.timezone,
        officialUrl: game.officialUrl,
        status: game.status,
        config,
      };
      const previous = existing.get(game.gameId);
      if (!previous) {
        await this.db.insert(games).values({ ...values, createdAt: now, updatedAt: now });
        outcomes.push('created');
      } else {
        const { createdAt: _c, updatedAt: _u, ...comparable } = previous;
        if (stableStringify(comparable) === stableStringify(values)) {
          outcomes.push('unchanged');
        } else {
          await this.db.update(games).set({ ...values, updatedAt: now }).where(eq(games.id, game.gameId));
          outcomes.push('updated');
        }
      }
      for (const [locale, name] of Object.entries(game.localizedNames)) {
        if (name) {
          await this.upsertLocalization(
            this.db,
            { entityKind: 'game', entityId: game.gameId, locale, field: 'name', value: name, origin: 'HUMAN' },
            now,
          );
        }
      }
    }
    return outcomeCounts(outcomes);
  }

  async syncSources(input: readonly SourceDefinition[], nowIso: string): Promise<SyncCounts> {
    const now = new Date(nowIso);
    const existing = new Map((await this.db.select().from(sources)).map((row) => [row.id, row]));
    const outcomes: Array<'created' | 'updated' | 'unchanged'> = [];
    for (const source of input) {
      const values = {
        id: source.id,
        gameId: source.gameId,
        name: source.name,
        type: source.type,
        isOfficial: source.isOfficial,
        homepageUrl: source.homepageUrl,
        allowedHosts: [...source.allowedHosts],
        authentication: source.authentication,
        rateLimit: source.rateLimit,
        contentTypes: [...source.contentTypes],
        collectorStatus: source.collectorStatus,
        termsUrl: source.termsUrl,
        termsReviewedAt: source.termsReviewedAt,
        robotsPolicy: source.robotsPolicy,
        attribution: source.attribution,
        dataRetentionDays: source.dataRetentionDays,
        notes: source.notes,
      };
      const previous = existing.get(source.id);
      if (!previous) {
        await this.db.insert(sources).values({ ...values, createdAt: now, updatedAt: now });
        outcomes.push('created');
        continue;
      }
      const { createdAt: _c, updatedAt: _u, ...comparable } = previous;
      if (stableStringify(comparable) === stableStringify(values)) {
        outcomes.push('unchanged');
      } else {
        await this.db.update(sources).set({ ...values, updatedAt: now }).where(eq(sources.id, source.id));
        outcomes.push('updated');
      }
    }
    return outcomeCounts(outcomes);
  }

  async syncResetRules(input: readonly ResetRuleDefinition[], nowIso: string): Promise<SyncCounts> {
    const now = new Date(nowIso);
    const existing = new Map((await this.db.select().from(resetRules)).map((row) => [row.id, row]));
    const outcomes: Array<'created' | 'updated' | 'unchanged'> = [];
    for (const rule of input) {
      const values = {
        id: rule.id,
        gameId: rule.gameId,
        name: rule.name,
        frequency: rule.frequency,
        timezone: rule.timezone,
        hour: rule.hour,
        minute: rule.minute,
        dayOfWeek: rule.dayOfWeek,
        dayOfMonth: rule.dayOfMonth,
        rrule: rule.rrule,
        anchor: dateOrNull(rule.anchor),
        region: rule.region,
        isPrimary: rule.isPrimary,
        verification: rule.verification,
        isSynthetic: rule.isSynthetic,
        sourceUrl: rule.sourceUrl,
        notes: rule.notes,
        isActive: true,
      };
      const previous = existing.get(rule.id);
      if (!previous) {
        await this.db.insert(resetRules).values({ ...values, createdAt: now, updatedAt: now });
        outcomes.push('created');
        continue;
      }
      const { createdAt: _c, updatedAt: _u, ...comparable } = previous;
      if (stableStringify(comparable) === stableStringify(values)) {
        outcomes.push('unchanged');
      } else {
        await this.db.update(resetRules).set({ ...values, updatedAt: now }).where(eq(resetRules.id, rule.id));
        outcomes.push('updated');
      }
    }
    return outcomeCounts(outcomes);
  }

  // ── ingestion runs ─────────────────────────────────────────────────────────

  async startRun(input: StartRunInput): Promise<IngestionRunRecord | null> {
    const now = new Date(input.now);
    await this.db
      .update(ingestionRuns)
      .set({ status: 'ABANDONED', finishedAt: now, error: 'stale run lock released' })
      .where(
        and(
          eq(ingestionRuns.adapterId, input.adapterId),
          eq(ingestionRuns.status, 'RUNNING'),
          lt(ingestionRuns.startedAt, new Date(now.getTime() - input.staleAfterMs)),
        ),
      );
    const inserted = await this.db
      .insert(ingestionRuns)
      .values({
        id: randomUUID(),
        adapterId: input.adapterId,
        sourceId: input.sourceId,
        gameId: input.gameId,
        trigger: input.trigger,
        mode: input.mode,
        status: 'RUNNING',
        startedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    return inserted[0] ? toRun(inserted[0]) : null;
  }

  async finishRun(runId: string, input: FinishRunInput): Promise<void> {
    await this.db
      .update(ingestionRuns)
      .set({
        status: input.status,
        finishedAt: new Date(input.finishedAt),
        discovered: input.counters.discovered,
        fetched: input.counters.fetched,
        newCount: input.counters.new,
        updatedCount: input.counters.updated,
        unchanged: input.counters.unchanged,
        failed: input.counters.failed,
        skipped: input.counters.skipped,
        error: input.error,
      })
      .where(eq(ingestionRuns.id, runId));
  }

  async listRuns(limit: number): Promise<IngestionRunRecord[]> {
    const rows = await this.db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(limit);
    return rows.map(toRun);
  }

  // ── raw documents & parse cache ────────────────────────────────────────────

  async findLatestRawDocument(sourceId: string, documentKey: string): Promise<StoredRawDocument | null> {
    const [row] = await this.db
      .select({
        id: rawDocuments.id,
        contentHash: rawDocuments.contentHash,
        etag: rawDocuments.etag,
        lastModified: rawDocuments.lastModified,
        fetchedAt: rawDocuments.fetchedAt,
      })
      .from(rawDocuments)
      .where(and(eq(rawDocuments.sourceId, sourceId), eq(rawDocuments.documentKey, documentKey)))
      .orderBy(desc(rawDocuments.fetchedAt))
      .limit(1);
    return row ? { ...row, fetchedAt: row.fetchedAt.toISOString() } : null;
  }

  async insertRawDocument(input: RawDocumentInput): Promise<{ id: string }> {
    const fetchedAt = new Date(input.fetchedAt);
    const [row] = await this.db
      .insert(rawDocuments)
      .values({
        id: randomUUID(),
        sourceId: input.sourceId,
        documentKey: input.documentKey,
        externalId: input.externalId,
        url: input.url,
        contentHash: input.contentHash,
        contentType: input.contentType,
        rawText: input.rawText,
        fetchedAt,
        lastCheckedAt: fetchedAt,
        httpStatus: input.httpStatus,
        etag: input.etag,
        lastModified: input.lastModified,
        locale: input.locale,
        ingestionRunId: input.ingestionRunId,
        metadata: input.metadata,
      })
      .onConflictDoUpdate({
        target: [rawDocuments.sourceId, rawDocuments.documentKey, rawDocuments.contentHash],
        set: {
          fetchedAt,
          lastCheckedAt: fetchedAt,
          rawText: input.rawText,
          httpStatus: input.httpStatus,
          etag: input.etag,
          lastModified: input.lastModified,
          ingestionRunId: input.ingestionRunId,
        },
      })
      .returning({ id: rawDocuments.id });
    if (!row) throw new Error('raw document upsert returned no row');
    return row;
  }

  async touchRawDocument(id: string, checkedAt: string): Promise<void> {
    await this.db.update(rawDocuments).set({ lastCheckedAt: new Date(checkedAt) }).where(eq(rawDocuments.id, id));
  }

  async pruneRawText(olderThan: string): Promise<number> {
    const rows = await this.db
      .update(rawDocuments)
      .set({ rawText: null })
      .where(and(sql`${rawDocuments.rawText} IS NOT NULL`, lt(rawDocuments.fetchedAt, new Date(olderThan))))
      .returning({ id: rawDocuments.id });
    return rows.length;
  }

  async findParseResult(inputHash: string, parserId: string, parserVersion: string): Promise<{ output: JsonValue | null } | null> {
    const [row] = await this.db
      .select({ output: parseResults.output })
      .from(parseResults)
      .where(
        and(
          eq(parseResults.inputHash, inputHash),
          eq(parseResults.parserId, parserId),
          eq(parseResults.parserVersion, parserVersion),
        ),
      )
      .limit(1);
    return row ? { output: row.output } : null;
  }

  async insertParseResult(input: ParseResultInput): Promise<void> {
    const values = {
      rawDocumentId: input.rawDocumentId,
      parserId: input.parserId,
      parserVersion: input.parserVersion,
      inputHash: input.inputHash,
      status: input.status,
      output: input.output,
      error: input.error,
      model: input.model,
      usage: input.usage,
      createdAt: new Date(input.createdAt),
    };
    await this.db
      .insert(parseResults)
      .values({ id: randomUUID(), ...values })
      .onConflictDoUpdate({
        target: [parseResults.inputHash, parseResults.parserId, parseResults.parserVersion],
        set: values,
      });
  }

  async insertValidationResults(results: readonly ValidationResultInput[]): Promise<void> {
    if (results.length === 0) return;
    await this.db.insert(validationResults).values(
      results.map((result) => ({
        id: randomUUID(),
        ingestionRunId: result.ingestionRunId,
        rawDocumentId: result.rawDocumentId,
        contentItemId: result.contentItemId,
        sourceId: result.sourceId,
        candidateKey: result.candidateKey,
        status: result.status,
        issues: result.issues,
        validatorVersion: result.validatorVersion,
        createdAt: new Date(result.createdAt),
      })),
    );
  }

  // ── content (write) ────────────────────────────────────────────────────────

  private refQuery(db: Database) {
    return db
      .select({
        id: contentItems.id,
        slug: contentItems.slug,
        gameId: contentItems.gameId,
        type: contentItems.type,
        sourceId: contentItems.sourceId,
        sourceType: sources.type,
        sourceKey: contentItems.sourceKey,
        semanticKey: contentItems.semanticKey,
        contentHash: contentItems.contentHash,
        status: contentItems.status,
        verification: contentItems.verification,
      })
      .from(contentItems)
      .innerJoin(sources, eq(sources.id, contentItems.sourceId));
  }

  async findContentBySourceKey(sourceId: string, sourceKey: string): Promise<ExistingContentRef | null> {
    const [direct] = await this.refQuery(this.db)
      .where(and(eq(contentItems.sourceId, sourceId), eq(contentItems.sourceKey, sourceKey)))
      .limit(1);
    if (direct) return direct;
    const [viaProvenance] = await this.refQuery(this.db)
      .innerJoin(contentSources, eq(contentSources.contentItemId, contentItems.id))
      .where(and(eq(contentSources.sourceId, sourceId), eq(contentSources.sourceKey, sourceKey)))
      .limit(1);
    return viaProvenance ?? null;
  }

  async findContentBySemanticKey(gameId: string, semanticKey: string): Promise<ExistingContentRef[]> {
    return this.refQuery(this.db).where(and(eq(contentItems.gameId, gameId), eq(contentItems.semanticKey, semanticKey)));
  }

  private async uniqueSlug(db: Database, preferred: string, contentId: string, seed: string): Promise<string> {
    const [owner] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(and(eq(contentItems.slug, preferred), ne(contentItems.id, contentId)))
      .limit(1);
    return owner ? slugWithSuffix(preferred, seed) : preferred;
  }

  private async upsertProvenance(db: Database, contentId: string, input: ProvenanceInput): Promise<void> {
    const seenAt = new Date(input.seenAt);
    await db
      .insert(contentSources)
      .values({
        id: randomUUID(),
        contentItemId: contentId,
        sourceId: input.sourceId,
        sourceKey: input.sourceKey,
        sourceUrl: input.sourceUrl,
        rawDocumentId: input.rawDocumentId,
        role: input.role,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      })
      .onConflictDoUpdate({
        target: [contentSources.contentItemId, contentSources.sourceId, contentSources.sourceKey],
        set: {
          sourceUrl: input.sourceUrl,
          role: input.role,
          lastSeenAt: seenAt,
          rawDocumentId: sql`coalesce(excluded.raw_document_id, ${contentSources.rawDocumentId})`,
        },
      });
  }

  private async resolveEntities(
    db: Database,
    gameId: string,
    locale: string,
    entries: Array<{ type: (typeof gameEntities.$inferInsert)['type']; key: string; name: string }>,
    now: Date,
  ): Promise<Map<string, string>> {
    const unique = new Map(entries.map((entry) => [pairKey(entry.type, entry.key), entry]));
    const ids = new Map<string, string>();
    for (const entry of unique.values()) {
      const [row] = await db
        .insert(gameEntities)
        .values({
          id: randomUUID(),
          gameId,
          type: entry.type,
          key: entry.key,
          name: entry.name,
          nameLocale: locale,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [gameEntities.gameId, gameEntities.type, gameEntities.key],
          set: { updatedAt: now },
        })
        .returning({ id: gameEntities.id });
      if (!row) continue;
      ids.set(pairKey(entry.type, entry.key), row.id);
      await this.upsertLocalization(
        db,
        { entityKind: 'game_entity', entityId: row.id, locale, field: 'name', value: entry.name, origin: 'SOURCE' },
        now,
      );
    }
    return ids;
  }

  private async writeDetail(db: Database, contentId: string, candidate: NormalizedCandidate, now: Date): Promise<void> {
    for (const table of [patches, events, rewards, redeemCodes, maintenances, banners]) {
      await db.delete(table).where(eq(table.contentItemId, contentId));
    }
    await db.delete(rewardItems).where(eq(rewardItems.contentItemId, contentId));

    const insertRewardItems = async (items: ReadonlyArray<{ name: string; quantity: number | null; unit: string | null }>) => {
      if (items.length === 0) return;
      await db.insert(rewardItems).values(
        items.map((item, index) => ({
          id: randomUUID(),
          contentItemId: contentId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          sortOrder: index,
        })),
      );
    };

    switch (candidate.kind) {
      case 'PATCH': {
        await db.insert(patches).values({
          contentItemId: contentId,
          version: candidate.patch.version,
          releaseAt: dateOrNull(candidate.patch.releaseAt),
        });
        const entityIds = await this.resolveEntities(
          db,
          candidate.gameId,
          candidate.sourceLocale,
          candidate.patch.changes
            .filter((change) => change.targetKey !== null)
            .map((change) => ({ type: change.targetType, key: change.targetKey ?? '', name: change.targetName })),
          now,
        );
        if (candidate.patch.changes.length > 0) {
          await db.insert(patchChanges).values(
            candidate.patch.changes.map((change, index) => ({
              id: randomUUID(),
              patchId: contentId,
              targetType: change.targetType,
              targetId: change.targetKey === null ? null : (entityIds.get(pairKey(change.targetType, change.targetKey)) ?? null),
              targetKey: change.targetKey,
              targetName: change.targetName,
              changeType: change.changeType,
              field: change.field,
              beforeValue: change.beforeValue,
              afterValue: change.afterValue,
              unit: change.unit,
              description: change.description,
              sortOrder: index,
            })),
          );
        }
        return;
      }
      case 'EVENT':
        await db.insert(events).values({
          contentItemId: contentId,
          eventType: candidate.event.eventType,
          eligibility: candidate.event.eligibility,
          rewardSummary: candidate.event.rewardSummary,
        });
        await insertRewardItems(candidate.event.rewards);
        return;
      case 'REWARD':
        await db.insert(rewards).values({
          contentItemId: contentId,
          rewardType: candidate.reward.rewardType,
          howToClaim: candidate.reward.howToClaim,
          relatedSourceKey: candidate.reward.relatedSourceKey,
        });
        await insertRewardItems(candidate.reward.items);
        return;
      case 'REDEEM_CODE':
        await db.insert(redeemCodes).values({
          contentItemId: contentId,
          code: candidate.redeemCode.code,
          region: candidate.redeemCode.region,
        });
        await insertRewardItems(candidate.redeemCode.items);
        return;
      case 'MAINTENANCE':
        await db.insert(maintenances).values({
          contentItemId: contentId,
          maintenanceType: candidate.maintenance.maintenanceType,
          affectedServers: [...candidate.maintenance.affectedServers],
          compensationSourceKey: candidate.maintenance.compensationSourceKey,
        });
        return;
      case 'BANNER': {
        await db.insert(banners).values({
          contentItemId: contentId,
          bannerType: candidate.banner.bannerType,
          phase: candidate.banner.phase,
        });
        const entityType = featuredEntityType(candidate.banner.bannerType);
        const entityIds = await this.resolveEntities(
          db,
          candidate.gameId,
          candidate.sourceLocale,
          candidate.banner.featured
            .filter((featured) => featured.entityKey !== null)
            .map((featured) => ({ type: entityType, key: featured.entityKey ?? '', name: featured.name })),
          now,
        );
        if (candidate.banner.featured.length > 0) {
          await db.insert(bannerFeatured).values(
            candidate.banner.featured.map((featured, index) => ({
              id: randomUUID(),
              bannerId: contentId,
              entityId: featured.entityKey === null ? null : (entityIds.get(pairKey(entityType, featured.entityKey)) ?? null),
              entityKey: featured.entityKey,
              name: featured.name,
              rarity: featured.rarity,
              sortOrder: index,
            })),
          );
        }
        return;
      }
      case 'UPDATE':
      case 'ANNOUNCEMENT':
        return;
    }
  }

  private contentValues(input: PublishInput, now: Date) {
    const { candidate } = input;
    return {
      gameId: candidate.gameId,
      type: candidate.kind,
      title: candidate.title,
      summary: candidate.summary,
      startAt: dateOrNull(candidate.startAt),
      endAt: dateOrNull(candidate.endAt),
      sourceTimezone: candidate.timing?.sourceTimezone ?? null,
      startAtSource: candidate.timing?.startAtSource ?? null,
      endAtSource: candidate.timing?.endAtSource ?? null,
      region: candidate.timing?.region ?? null,
      timePrecision: candidate.timing?.precision ?? 'DATETIME',
      hasTiming: candidate.timing !== null,
      sourcePublishedAt: dateOrNull(candidate.sourcePublishedAt),
      status: input.status,
      priority: candidate.priority,
      sourceId: input.source.id,
      sourceKey: candidate.sourceKey,
      sourceUrl: candidate.sourceUrl,
      sourceLocale: candidate.sourceLocale,
      rawDocumentId: input.rawDocumentId,
      semanticKey: input.semanticKey,
      contentHash: input.contentHash,
      confidence: candidate.confidence,
      verification: input.verification,
      verifiedAt: dateOrNull(input.verifiedAt),
      validationStatus: input.validationStatus,
      parserId: input.parser.id,
      parserVersion: input.parser.version,
      isSynthetic: candidate.isSynthetic,
      evidence: candidate.evidence,
      metadata: candidate.metadata,
      lastSeenAt: now,
      updatedAt: now,
    };
  }

  async publishContent(input: PublishInput): Promise<PublishOutcome> {
    const now = new Date(input.now);
    const { candidate, source } = input;
    const primary: ProvenanceInput = {
      sourceId: source.id,
      sourceKey: candidate.sourceKey,
      sourceUrl: candidate.sourceUrl,
      rawDocumentId: input.rawDocumentId,
      role: 'PRIMARY',
      seenAt: input.now,
    };

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: contentItems.id,
          slug: contentItems.slug,
          sourceId: contentItems.sourceId,
          sourceKey: contentItems.sourceKey,
          contentHash: contentItems.contentHash,
          status: contentItems.status,
        })
        .from(contentItems)
        .where(
          input.supersedeId === null
            ? and(eq(contentItems.sourceId, source.id), eq(contentItems.sourceKey, candidate.sourceKey))
            : eq(contentItems.id, input.supersedeId),
        )
        .limit(1)
        .for('update');

      if (existing) {
        const sameSource = existing.sourceId === source.id && existing.sourceKey === candidate.sourceKey;
        if (sameSource && existing.contentHash === input.contentHash && existing.status === input.status) {
          await tx.update(contentItems).set({ lastSeenAt: now }).where(eq(contentItems.id, existing.id));
          await this.upsertProvenance(tx, existing.id, primary);
          return { id: existing.id, slug: existing.slug, outcome: 'unchanged' as const };
        }
        if (!sameSource) {
          await tx.update(contentSources).set({ role: 'SUPPORTING' }).where(eq(contentSources.contentItemId, existing.id));
        }
        await tx.update(contentItems).set(this.contentValues(input, now)).where(eq(contentItems.id, existing.id));
        await this.writeDetail(tx, existing.id, candidate, now);
        await this.upsertProvenance(tx, existing.id, primary);
        return { id: existing.id, slug: existing.slug, outcome: 'updated' as const };
      }

      const id = contentIdFor(source.id, candidate.sourceKey);
      const slug = await this.uniqueSlug(tx, input.slug, id, `${source.id}:${candidate.sourceKey}`);
      await tx.insert(contentItems).values({
        id,
        slug,
        ...this.contentValues(input, now),
        publishedAt: now,
        createdAt: now,
      });
      await this.writeDetail(tx, id, candidate, now);
      await this.upsertProvenance(tx, id, primary);
      return { id, slug, outcome: 'created' as const };
    });
  }

  async recordProvenance(contentId: string, input: ProvenanceInput): Promise<void> {
    await this.upsertProvenance(this.db, contentId, input);
  }

  // ── content (read) ─────────────────────────────────────────────────────────

  private effectiveTime(): SQL {
    return sql`coalesce(${contentItems.startAt}, ${contentItems.sourcePublishedAt}, ${contentItems.publishedAt})`;
  }

  private windowCondition(window: { from: string; to: string }): SQL {
    const from = sql`${window.from}::timestamptz`;
    const to = sql`${window.to}::timestamptz`;
    const pointInTime = or(
      inArray(contentItems.type, [...POINT_IN_TIME_TYPES]),
      and(sql`${contentItems.startAt} IS NULL`, sql`${contentItems.endAt} IS NULL`),
    );
    return sql`(CASE WHEN ${pointInTime} THEN ${this.effectiveTime()} BETWEEN ${from} AND ${to}
      ELSE (${contentItems.endAt} IS NULL OR ${contentItems.endAt} >= ${from})
       AND (${contentItems.startAt} IS NULL OR ${contentItems.startAt} <= ${to}) END)`;
  }

  async listContent(query: ContentQuery): Promise<ContentRecord[]> {
    const conditions: SQL[] = [inArray(contentItems.status, [...(query.statuses ?? ['PUBLISHED'])])];
    if (query.gameIds) conditions.push(query.gameIds.length === 0 ? sql`false` : inArray(contentItems.gameId, [...query.gameIds]));
    if (query.types) conditions.push(query.types.length === 0 ? sql`false` : inArray(contentItems.type, [...query.types]));
    if (query.includeSynthetic === false) conditions.push(eq(contentItems.isSynthetic, false));
    if (query.window) conditions.push(this.windowCondition(query.window));

    const order = query.order === 'start' ? asc(this.effectiveTime()) : desc(this.effectiveTime());
    const base = this.db
      .select()
      .from(contentItems)
      .where(and(...conditions))
      .orderBy(order, asc(contentItems.id));
    const rows = query.limit === undefined ? await base : await base.limit(query.limit);
    return this.hydrate(rows);
  }

  async getContentBySlug(slug: string): Promise<ContentRecord | null> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.slug, slug), eq(contentItems.status, 'PUBLISHED')))
      .limit(1);
    const [record] = await this.hydrate(rows);
    return record ?? null;
  }

  async listResetRules(gameIds?: readonly string[]): Promise<ResetRuleDefinition[]> {
    const conditions: SQL[] = [eq(resetRules.isActive, true)];
    if (gameIds) conditions.push(gameIds.length === 0 ? sql`false` : inArray(resetRules.gameId, [...gameIds]));
    const rows = await this.db
      .select()
      .from(resetRules)
      .where(and(...conditions))
      .orderBy(asc(resetRules.gameId), asc(resetRules.id));
    return rows.map((row) => ({
      id: row.id,
      gameId: row.gameId,
      name: row.name,
      frequency: row.frequency,
      timezone: row.timezone,
      hour: row.hour,
      minute: row.minute,
      dayOfWeek: row.dayOfWeek,
      dayOfMonth: row.dayOfMonth,
      rrule: row.rrule,
      anchor: isoOrNull(row.anchor),
      region: row.region,
      isPrimary: row.isPrimary,
      verification: row.verification,
      isSynthetic: row.isSynthetic,
      sourceUrl: row.sourceUrl,
      notes: row.notes,
    }));
  }

  async listContentSlugs(): Promise<ContentSlugEntry[]> {
    const rows = await this.db
      .select({
        slug: contentItems.slug,
        type: contentItems.type,
        gameId: contentItems.gameId,
        updatedAt: contentItems.updatedAt,
        isSynthetic: contentItems.isSynthetic,
      })
      .from(contentItems)
      .where(eq(contentItems.status, 'PUBLISHED'))
      .orderBy(asc(contentItems.slug));
    return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  }

  async getLastUpdatedAt(gameId?: string): Promise<string | null> {
    const conditions: SQL[] = [eq(contentItems.status, 'PUBLISHED')];
    if (gameId) conditions.push(eq(contentItems.gameId, gameId));
    const [row] = await this.db
      .select({ value: max(contentItems.updatedAt) })
      .from(contentItems)
      .where(and(...conditions));
    return row?.value ? toIso(row.value) : null;
  }

  private async hydrate(rows: ContentRow[]): Promise<ContentRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const sourceIds = [...new Set(rows.map((row) => row.sourceId))];

    const [
      sourceRows,
      patchRows,
      changeRows,
      eventRows,
      rewardRows,
      itemRows,
      codeRows,
      maintenanceRows,
      bannerRows,
      featuredRows,
      provenanceRows,
    ] = await Promise.all([
      this.db.select().from(sources).where(inArray(sources.id, sourceIds)),
      this.db.select().from(patches).where(inArray(patches.contentItemId, ids)),
      this.db.select().from(patchChanges).where(inArray(patchChanges.patchId, ids)).orderBy(asc(patchChanges.sortOrder)),
      this.db.select().from(events).where(inArray(events.contentItemId, ids)),
      this.db.select().from(rewards).where(inArray(rewards.contentItemId, ids)),
      this.db.select().from(rewardItems).where(inArray(rewardItems.contentItemId, ids)).orderBy(asc(rewardItems.sortOrder)),
      this.db.select().from(redeemCodes).where(inArray(redeemCodes.contentItemId, ids)),
      this.db.select().from(maintenances).where(inArray(maintenances.contentItemId, ids)),
      this.db.select().from(banners).where(inArray(banners.contentItemId, ids)),
      this.db.select().from(bannerFeatured).where(inArray(bannerFeatured.bannerId, ids)).orderBy(asc(bannerFeatured.sortOrder)),
      this.db
        .select({
          contentItemId: contentSources.contentItemId,
          sourceId: contentSources.sourceId,
          sourceName: sources.name,
          sourceType: sources.type,
          sourceUrl: contentSources.sourceUrl,
          role: contentSources.role,
          firstSeenAt: contentSources.firstSeenAt,
          lastSeenAt: contentSources.lastSeenAt,
        })
        .from(contentSources)
        .innerJoin(sources, eq(sources.id, contentSources.sourceId))
        .where(inArray(contentSources.contentItemId, ids)),
    ]);

    const rowById = new Map(rows.map((row) => [row.id, row]));
    const relatedKeys = [
      ...rewardRows.map((row) => row.relatedSourceKey),
      ...maintenanceRows.map((row) => row.compensationSourceKey),
    ].filter((value): value is string => value !== null);
    const linkedSlugs = new Map<string, string>();
    if (relatedKeys.length > 0) {
      const linked = await this.db
        .select({ sourceId: contentItems.sourceId, sourceKey: contentItems.sourceKey, slug: contentItems.slug })
        .from(contentItems)
        .where(inArray(contentItems.sourceKey, [...new Set(relatedKeys)]));
      for (const row of linked) linkedSlugs.set(pairKey(row.sourceId, row.sourceKey), row.slug);
    }
    const slugFor = (contentId: string, sourceKey: string | null) => {
      const owner = rowById.get(contentId);
      return sourceKey === null || !owner ? null : (linkedSlugs.get(pairKey(owner.sourceId, sourceKey)) ?? null);
    };

    const group = <T extends { contentItemId: string }>(list: T[]) => {
      const map = new Map<string, T[]>();
      for (const entry of list) map.set(entry.contentItemId, [...(map.get(entry.contentItemId) ?? []), entry]);
      return map;
    };
    const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
    const patchById = new Map(patchRows.map((row) => [row.contentItemId, row]));
    const changesById = group(changeRows.map((row) => ({ ...row, contentItemId: row.patchId })));
    const eventById = new Map(eventRows.map((row) => [row.contentItemId, row]));
    const rewardById = new Map(rewardRows.map((row) => [row.contentItemId, row]));
    const itemsById = group(itemRows);
    const codeById = new Map(codeRows.map((row) => [row.contentItemId, row]));
    const maintenanceById = new Map(maintenanceRows.map((row) => [row.contentItemId, row]));
    const bannerById = new Map(bannerRows.map((row) => [row.contentItemId, row]));
    const featuredById = group(featuredRows.map((row) => ({ ...row, contentItemId: row.bannerId })));
    const provenanceById = group(provenanceRows);

    const rewardLines = (id: string) =>
      (itemsById.get(id) ?? []).map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit }));

    const detailFor = (row: ContentRow): ContentDetail => {
      switch (row.type) {
        case 'PATCH': {
          const patch = patchById.get(row.id);
          return {
            type: 'PATCH',
            version: patch?.version ?? '',
            releaseAt: isoOrNull(patch?.releaseAt ?? null),
            changes: (changesById.get(row.id) ?? []).map((change) => ({
              targetType: change.targetType,
              targetKey: change.targetKey,
              targetName: change.targetName,
              changeType: change.changeType,
              field: change.field,
              beforeValue: change.beforeValue,
              afterValue: change.afterValue,
              unit: change.unit,
              description: change.description,
            })),
          };
        }
        case 'EVENT': {
          const event = eventById.get(row.id);
          return {
            type: 'EVENT',
            eventType: event?.eventType ?? 'OTHER',
            eligibility: event?.eligibility ?? null,
            rewardSummary: event?.rewardSummary ?? null,
            rewards: rewardLines(row.id),
          };
        }
        case 'REWARD': {
          const reward = rewardById.get(row.id);
          return {
            type: 'REWARD',
            rewardType: reward?.rewardType ?? 'OTHER',
            howToClaim: reward?.howToClaim ?? null,
            items: rewardLines(row.id),
            relatedSlug: slugFor(row.id, reward?.relatedSourceKey ?? null),
          };
        }
        case 'REDEEM_CODE': {
          const code = codeById.get(row.id);
          return { type: 'REDEEM_CODE', code: code?.code ?? '', region: code?.region ?? null, items: rewardLines(row.id) };
        }
        case 'MAINTENANCE': {
          const maintenance = maintenanceById.get(row.id);
          return {
            type: 'MAINTENANCE',
            maintenanceType: maintenance?.maintenanceType ?? 'SCHEDULED',
            affectedServers: maintenance?.affectedServers ?? [],
            compensationSlug: slugFor(row.id, maintenance?.compensationSourceKey ?? null),
          };
        }
        case 'BANNER': {
          const banner = bannerById.get(row.id);
          return {
            type: 'BANNER',
            bannerType: banner?.bannerType ?? 'OTHER',
            phase: banner?.phase ?? null,
            featured: (featuredById.get(row.id) ?? []).map((featured) => ({
              name: featured.name,
              entityKey: featured.entityKey,
              rarity: featured.rarity,
            })),
          };
        }
        case 'UPDATE':
          return { type: 'UPDATE' };
        case 'ANNOUNCEMENT':
          return { type: 'ANNOUNCEMENT' };
      }
    };

    return rows.map((row) => {
      const sourceRow = sourceById.get(row.sourceId);
      if (!sourceRow) throw new Error(`Source "${row.sourceId}" is missing`);
      return {
        id: row.id,
        slug: row.slug,
        gameId: row.gameId,
        type: row.type,
        title: row.title,
        summary: row.summary,
        startAt: isoOrNull(row.startAt),
        endAt: isoOrNull(row.endAt),
        timing: row.hasTiming
          ? {
              sourceTimezone: row.sourceTimezone,
              startAtSource: row.startAtSource,
              endAtSource: row.endAtSource,
              region: row.region,
              precision: row.timePrecision,
            }
          : null,
        publishedAt: row.publishedAt.toISOString(),
        sourcePublishedAt: isoOrNull(row.sourcePublishedAt),
        updatedAt: row.updatedAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        priority: row.priority,
        status: row.status,
        verification: row.verification,
        verifiedAt: isoOrNull(row.verifiedAt),
        validationStatus: row.validationStatus,
        confidence: row.confidence,
        isSynthetic: row.isSynthetic,
        sourceLocale: row.sourceLocale,
        parser: { id: row.parserId, version: row.parserVersion },
        source: sourceSummaryOf(sourceRow, row.sourceUrl),
        provenance: (provenanceById.get(row.id) ?? [])
          .map((entry) => ({
            sourceId: entry.sourceId,
            sourceName: entry.sourceName,
            sourceType: entry.sourceType,
            sourceUrl: entry.sourceUrl,
            role: entry.role,
            firstSeenAt: entry.firstSeenAt.toISOString(),
            lastSeenAt: entry.lastSeenAt.toISOString(),
          }))
          .sort((a, b) =>
            a.role === b.role ? a.firstSeenAt.localeCompare(b.firstSeenAt) : a.role === 'PRIMARY' ? -1 : 1,
          ),
        detail: detailFor(row),
      };
    });
  }
}
