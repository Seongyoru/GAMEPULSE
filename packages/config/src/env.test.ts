import { describe, expect, it } from 'vitest';
import { EnvError, fixturesAllowed, parseServerEnv, resolveDataSource } from './env';

describe('parseServerEnv', () => {
  it('treats empty strings as unset and applies safe defaults', () => {
    const env = parseServerEnv({ DATABASE_URL: '', GAMEPULSE_SITE_URL: '', COLLECTOR_MODE: '' });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.GAMEPULSE_SITE_URL).toBe('http://localhost:3000');
    expect(env.COLLECTOR_MODE).toBe('fixture');
    expect(env.GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION).toBe(false);
  });
});

describe('resolveDataSource', () => {
  it('uses the database when configured and fixtures otherwise (development)', () => {
    expect(resolveDataSource(parseServerEnv({ DATABASE_URL: 'postgres://db/x' }))).toBe('database');
    expect(resolveDataSource(parseServerEnv({}))).toBe('fixtures');
  });

  it('refuses synthetic fixtures in production unless explicitly allowed', () => {
    const production = parseServerEnv({ NODE_ENV: 'production' });
    expect(fixturesAllowed(production)).toBe(false);
    expect(() => resolveDataSource(production)).toThrow(EnvError);

    const preview = parseServerEnv({
      NODE_ENV: 'production',
      GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION: 'true',
    });
    expect(fixturesAllowed(preview)).toBe(true);
    expect(resolveDataSource(preview)).toBe('fixtures');
  });

  it('requires DATABASE_URL when the database is requested', () => {
    expect(() => resolveDataSource(parseServerEnv({ GAMEPULSE_DATA_SOURCE: 'database' }))).toThrow(
      /requires DATABASE_URL/,
    );
  });
});
