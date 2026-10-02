/**
 * Minimal structured logger (JSON lines in production, readable lines in development).
 * Dependency-free so it runs unchanged in the worker, CLI and Next.js server.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export interface LogEntry {
  time: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Returns a logger that adds `bindings` to every entry (e.g. adapter, game, runId). */
  child(bindings: LogFields): Logger;
}

export type LogSink = (entry: LogEntry) => void;

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Converts Errors (including nested causes) into plain JSON-safe objects. */
export function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return error;
  const serialized: Record<string, unknown> = { name: error.name, message: error.message };
  if (error.stack) serialized.stack = error.stack;
  if (error.cause !== undefined && depth < 3)
    serialized.cause = serializeError(error.cause, depth + 1);
  return serialized;
}

function serializeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    out[key] = value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

function formatPretty(entry: LogEntry): string {
  const { time, level, msg, ...rest } = entry;
  const extras = Object.entries(rest)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  return `${time.slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${msg}${extras ? ` ${extras}` : ''}`;
}

export function consoleSink(format: 'json' | 'pretty'): LogSink {
  return (entry) => {
    const line = format === 'json' ? JSON.stringify(entry) : formatPretty(entry);
    if (entry.level === 'error' || entry.level === 'warn') console.error(line);
    else console.log(line);
  };
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: 'json' | 'pretty';
  sink?: LogSink;
  bindings?: LogFields;
  clock?: () => Date;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const minRank = LEVEL_RANK[options.level ?? 'info'];
  const sink = options.sink ?? consoleSink(options.format ?? 'json');
  const clock = options.clock ?? (() => new Date());
  const bindings = serializeFields(options.bindings ?? {});

  const write = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (LEVEL_RANK[level] < minRank) return;
    sink({
      time: clock().toISOString(),
      level,
      msg,
      ...bindings,
      ...(fields ? serializeFields(fields) : {}),
    });
  };

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    child: (extra) =>
      createLogger({
        ...options,
        sink,
        clock,
        bindings: { ...bindings, ...serializeFields(extra) },
      }),
  };
}

/** Logger that captures entries in memory (tests, diagnostics). */
export function createMemoryLogger(level: LogLevel = 'debug'): {
  logger: Logger;
  entries: LogEntry[];
} {
  const entries: LogEntry[] = [];
  return { logger: createLogger({ level, sink: (entry) => entries.push(entry) }), entries };
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};
