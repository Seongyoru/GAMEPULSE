/**
 * HTTP transports. FetchTransport performs real requests (live mode); MockTransport replays
 * scripted responses (mock mode and tests) so live adapter code runs without any network.
 */

export interface HttpRequest {
  url: string;
  method: 'GET' | 'HEAD';
  headers: Record<string, string>;
  timeoutMs: number;
}

export interface HttpResponse {
  /** Final URL after redirects. */
  url: string;
  status: number;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  body: string;
}

export interface HttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export class FetchTransport implements HttpTransport {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const body = request.method === 'HEAD' ? '' : await response.text();
    return { url: response.url || request.url, status: response.status, headers, body };
  }
}

export interface MockResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  /** String bodies are sent verbatim; other values are JSON-encoded. */
  body?: unknown;
  /** Simulates a network failure instead of a response. */
  networkError?: string;
}

interface MockRoute {
  match: (url: string) => boolean;
  responses: MockResponseSpec[];
  served: number;
}

/**
 * Scripted transport. Responses registered for a route are served in order; the last one
 * repeats. Unmatched URLs return 404.
 */
export class MockTransport implements HttpTransport {
  readonly requests: HttpRequest[] = [];
  private readonly routes: MockRoute[] = [];

  on(pattern: string | RegExp, ...responses: MockResponseSpec[]): this {
    const match =
      typeof pattern === 'string'
        ? (url: string) => url === pattern
        : (url: string) => pattern.test(url);
    this.routes.push({ match, responses: responses.length > 0 ? responses : [{}], served: 0 });
    return this;
  }

  send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    const route = this.routes.find((candidate) => candidate.match(request.url));
    if (!route)
      return Promise.resolve({ url: request.url, status: 404, headers: {}, body: 'not found' });
    const spec = route.responses[Math.min(route.served, route.responses.length - 1)] ?? {};
    route.served += 1;
    if (spec.networkError !== undefined) return Promise.reject(new TypeError(spec.networkError));
    const body =
      spec.body === undefined
        ? ''
        : typeof spec.body === 'string'
          ? spec.body
          : JSON.stringify(spec.body);
    const headers = Object.fromEntries(
      Object.entries(spec.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    if (typeof spec.body === 'object' && spec.body !== null && !('content-type' in headers)) {
      headers['content-type'] = 'application/json; charset=utf-8';
    }
    return Promise.resolve({ url: request.url, status: spec.status ?? 200, headers, body });
  }
}
