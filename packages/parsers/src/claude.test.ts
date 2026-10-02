/**
 * ClaudeParser against a stub fetch: the real SDK request/stream/parse path runs, but nothing
 * leaves the process and no paid request is ever made.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { ClaudeParser, type ClaudeOutput } from './claude';
import { ParserError, type ParserInput } from './types';

interface CapturedRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function sse(events: Array<Record<string, unknown>>): string {
  return events
    .map((data) => `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
}

function streamedMessage(
  text: string,
  stopReason = 'end_turn',
  category: string | null = null,
): string {
  return sse([
    {
      type: 'message_start',
      message: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 1800,
          output_tokens: 1,
          cache_read_input_tokens: 1500,
          cache_creation_input_tokens: 0,
        },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null,
        ...(stopReason === 'refusal'
          ? { stop_details: { type: 'refusal', category, explanation: null } }
          : {}),
      },
      usage: { output_tokens: 420 },
    },
    { type: 'message_stop' },
  ]);
}

function stubClient(body: string): { client: Anthropic; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = [];
  const client = new Anthropic({
    apiKey: 'test-key-not-real',
    maxRetries: 0,
    fetch: (input, init) => {
      requests.push({
        url: String(input instanceof Request ? input.url : input),
        headers: new Headers(init?.headers),
        body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
          string,
          unknown
        >,
      });
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      );
    },
  });
  return { client, requests };
}

const input: ParserInput = {
  task: 'EVENT',
  gameId: 'genshin',
  sourceUrl: 'https://genshin.hoyoverse.com/ko/news',
  sourceLocale: 'ko-KR',
  title: '「별빛 퍼즐」 이벤트',
  text: '이벤트 기간: 2026/09/30 11:00 ~ 2026/11/03 04:59\n보상: 원석 ×120',
  publishedAt: '2026-09-29T03:00:00.000Z',
  defaultTimezone: 'Asia/Seoul',
  serverTimezone: 'UTC+8',
};

function item(
  overrides: Partial<ClaudeOutput['items'][number]> = {},
): ClaudeOutput['items'][number] {
  return {
    kind: 'EVENT',
    title: '「별빛 퍼즐」 이벤트',
    summary: '퍼즐을 완성하고 원석을 받는 웹 이벤트.',
    start: { text: '2026/09/30 11:00', local: '2026-09-30T11:00', zoneLabel: null },
    end: { text: '2026/11/03 04:59', local: '2026-11-03T04:59', zoneLabel: null },
    eventType: 'WEB',
    rewardType: null,
    maintenanceType: null,
    bannerType: null,
    rewardSummary: '원석 ×120',
    rewards: [{ name: '원석', quantity: 120, unit: null }],
    redeemCode: null,
    version: null,
    patchChanges: [],
    featured: [],
    affectedServers: [],
    evidence: [{ field: 'startAt', excerpt: '2026/09/30 11:00 ~ 2026/11/03 04:59' }],
    confidence: 0.92,
    ...overrides,
  };
}

const respond = (...items: Array<ClaudeOutput['items'][number]>) =>
  streamedMessage(JSON.stringify({ items }));

describe('ClaudeParser', () => {
  it('sends a cached, structured-output request with server-side fallback', async () => {
    const { client, requests } = stubClient(respond(item()));
    const parser = new ClaudeParser({ client });
    const output = await parser.parse(input);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toContain('/v1/messages');
    expect(request?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(request?.body).toMatchObject({
      model: 'claude-opus-5-5',
      stream: true,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      system: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
    });
    const messages = request?.body.messages as Array<{ content: string }>;
    expect(messages[0]?.content).toContain('<document>\n이벤트 기간');
    expect(output.model).toBe('claude-opus-5-5');
    expect(output.usage).toMatchObject({
      inputTokens: 1800,
      outputTokens: 420,
      cacheReadInputTokens: 1500,
    });
    expect(parser.version).toBe('claude-1:claude-opus-5-5:medium');
  });

  it('converts transcribed local times in code, using the source policy zone for unlabeled times', async () => {
    const { client } = stubClient(respond(item()));
    const { extraction } = await new ClaudeParser({ client }).parse(input);
    expect(extraction.items[0]).toMatchObject({
      startAt: '2026-09-30T02:00:00.000Z',
      endAt: '2026-11-02T19:59:00.000Z',
      startAtSource: '2026/09/30 11:00',
      sourceTimezone: 'Asia/Seoul',
      datePrecision: 'DATETIME',
      rewards: [{ name: '원석', quantity: 120, unit: null }],
    });
  });

  it('honours explicit labels, never guesses unknown ones, and keeps dates date-only', async () => {
    const { client } = stubClient(
      respond(
        item({
          start: {
            text: '2026/09/30 10:00 (UTC+8)',
            local: '2026-09-30T10:00',
            zoneLabel: 'UTC+8',
          },
          end: null,
        }),
        item({
          title: '서버 시간 이벤트',
          start: {
            text: '10월 1일 04:00 (서버 시간)',
            local: '2026-10-01T04:00',
            zoneLabel: '서버 시간',
          },
          end: null,
        }),
        item({
          title: '모호한 시간',
          start: { text: '10/02 10:00 (PT?)', local: '2026-10-02T10:00', zoneLabel: 'PT?' },
          end: null,
        }),
        item({
          title: '날짜만',
          start: { text: '10월 8일', local: '2026-10-08', zoneLabel: null },
          end: { text: '10월 21일까지', local: '2026-10-21', zoneLabel: null },
        }),
      ),
    );
    const { extraction } = await new ClaudeParser({ client }).parse(input);
    const [explicit, server, unknown, dateOnly] = extraction.items;
    expect(explicit).toMatchObject({
      startAt: '2026-09-30T02:00:00.000Z',
      sourceTimezone: 'UTC+8',
    });
    expect(server).toMatchObject({ startAt: '2026-09-30T20:00:00.000Z', sourceTimezone: 'UTC+8' });
    expect(unknown).toMatchObject({
      startAt: null,
      sourceTimezone: null,
      startAtSource: '10/02 10:00 (PT?)',
    });
    expect(dateOnly).toMatchObject({
      startAt: '2026-10-07T15:00:00.000Z',
      endAt: '2026-10-21T14:59:00.000Z',
      datePrecision: 'DATE',
    });
  });

  it('drops values that cannot be facts instead of storing them', async () => {
    const { client } = stubClient(
      respond(
        item({
          kind: 'REDEEM_CODE',
          redeemCode: 'NOT A CODE!',
          rewards: [{ name: '모라', quantity: -5, unit: null }],
          confidence: 7,
        }),
      ),
    );
    const { extraction } = await new ClaudeParser({ client }).parse(input);
    expect(extraction.items[0]).toMatchObject({
      redeemCode: null,
      rewards: [{ name: '모라', quantity: null }],
      confidence: 1,
    });
  });

  it('turns refusals and truncated output into parser errors', async () => {
    const refused = stubClient(streamedMessage('', 'refusal', 'cyber'));
    await expect(new ClaudeParser({ client: refused.client }).parse(input)).rejects.toThrow(
      /declined the document \(cyber\)/,
    );
    const truncated = stubClient(streamedMessage('{"items":[', 'max_tokens'));
    await expect(
      new ClaudeParser({ client: truncated.client }).parse(input),
    ).rejects.toBeInstanceOf(ParserError);
  });

  it('rejects oversized documents without calling the API', async () => {
    const { client, requests } = stubClient(respond(item()));
    const parser = new ClaudeParser({ client, maxInputChars: 20 });
    await expect(parser.parse(input)).rejects.toThrow(/AI limit/);
    expect(requests).toHaveLength(0);
  });

  it('can omit effort and server fallback for models that do not support them', async () => {
    const { client, requests } = stubClient(respond(item()));
    await new ClaudeParser({
      client,
      model: 'claude-haiku-4-5',
      effort: null,
      serverFallback: false,
    }).parse(input);
    expect(requests[0]?.body).not.toHaveProperty('fallbacks');
    expect(requests[0]?.body.output_config).not.toHaveProperty('effort');
  });
});
