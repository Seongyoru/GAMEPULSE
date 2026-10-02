/**
 * Server error reporting: every error the Next.js server captures is logged as one JSON line
 * (route, path, digest, error) for the log pipeline / Sentry-compatible collectors.
 * Request headers are never logged (cookies, tokens).
 */
import { createLogger } from '@gamepulse/observability';
import type { Instrumentation } from 'next';

const logger = createLogger({
  level: 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  bindings: { service: 'web' },
});

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : null;
  logger.error('request failed', {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    revalidateReason: context.revalidateReason ?? null,
    digest,
    error,
  });
};
