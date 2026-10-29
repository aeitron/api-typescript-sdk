/**
 * Aeitron Official TypeScript SDK
 * Zero-dependency, strictly-typed client for Global Infrastructure, Multi-Objective AI Orchestration,
 * Custom Edge Domains, and Real-Time Telemetry.
 */

export type RoutingStrategy =
  | 'LATENCY_OPTIMAL'
  | 'COST_MINIMAL'
  | 'CARBON_NEUTRAL'
  | 'SOVEREIGN_PINNED';

export * from './generated/types';
export * from './generated/namespaces';
import {
  GatewayNamespace,
  CatalogNamespace,
  OrdersNamespace,
  InvoicesNamespace,
  DomainCatalogNamespace,
  DNSNamespace,
  ComputeNamespace,
  DatabasesNamespace,
  WebhooksNamespace,
  FleetNamespace,
  AuditNamespace
} from './generated/namespaces';

export type Jurisdiction = 'BD' | 'EU' | 'US' | 'GLOBAL';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  routingStrategy?: RoutingStrategy;
  jurisdiction?: Jurisdiction;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionTelemetry {
  provider: string | null;
  cost: number | null;
  ttftMs: number | null;
  region: string | null;
}

export interface CompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason?: string;
}

export interface CompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: CompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  telemetry: CompletionTelemetry;
}

export interface DomainRecord {
  id: string;
  project_id: string;
  hostname: string;
  cname_target?: string;
  origin_address?: string;
  origin_port?: number;
  origin_protocol?: string;
  status: string;
  allowed_pops?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface OnboardDomainParams {
  hostname: string;
  originAddress: string;
  originPort?: number;
  originProtocol?: 'http' | 'https';
  allowedPoPs?: string[];
}

export interface OnboardDomainResult {
  domain_id: string;
  hostname: string;
  cname_target: string;
  verification_token: string;
  status: string;
  allowed_pops: string[];
}

export interface VerifyDomainResult {
  status: string;
  domain_id: string;
  hostname: string;
  state: string;
  message?: string;
}

export interface TelemetrySummary {
  project_id: string;
  total_requests: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  cache_hit_ratio: number;
  threat_blocks: number;
  success_rate: number;
  status_distribution: {
    '2xx': number;
    '4xx': number;
    '5xx': number;
  };
  pop_distribution: Record<string, number>;
  rate_limit?: {
    limit: number;
    remaining: number;
  };
}

export interface LatencyMatrixRoute {
  from_pop: string;
  to_pop?: string;
  to_target?: string;
  latency_ms: number;
  status?: string;
}

export interface LatencyMatrixResult {
  routes: LatencyMatrixRoute[];
  timestamp?: string;
}

export interface PoPHealthRecord {
  id: string;
  name: string;
  region: string;
  status: string;
  latency_p50_ms: number;
  capacity_used_pct: number;
  anycast_announced: boolean;
}

import * as crypto from 'node:crypto';

export interface AeitronClientOptions {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
  fetch?: typeof fetch;
}

export class AeitronError extends Error {
  public readonly status: number;
  public readonly code: string | number;
  public readonly details: unknown;

  constructor(status: number, message: string, code?: string | number, details?: unknown) {
    super(message);
    this.name = 'AeitronError';
    this.status = status;
    this.code = code || status;
    this.details = details;
    Object.setPrototypeOf(this, AeitronError.prototype);
  }
}

export class AuthenticationError extends AeitronError {
  constructor(message = 'Authentication failed', code: string | number = 'UNAUTHORIZED', details?: unknown) {
    super(401, message, code, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class PermissionDeniedError extends AeitronError {
  constructor(message = 'Permission denied', code: string | number = 'FORBIDDEN', details?: unknown) {
    super(403, message, code, details);
    this.name = 'PermissionDeniedError';
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

export class ApprovalRequiredError extends AeitronError {
  public readonly challengeRequestId: string;
  public readonly domain?: string;
  public readonly recordId?: string;

  constructor(
    message: string,
    challengeRequestId: string,
    domain?: string,
    recordId?: string,
    details?: unknown
  ) {
    super(403, message, 'APPROVAL_REQUIRED', details);
    this.name = 'ApprovalRequiredError';
    this.challengeRequestId = challengeRequestId;
    this.domain = domain;
    this.recordId = recordId;
    Object.setPrototypeOf(this, ApprovalRequiredError.prototype);
  }
}

export class NotFoundError extends AeitronError {
  constructor(message = 'Resource not found', code: string | number = 'NOT_FOUND', details?: unknown) {
    super(404, message, code, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AeitronError {
  constructor(message = 'Resource conflict', code: string | number = 'CONFLICT', details?: unknown) {
    super(409, message, code, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ExpiredError extends AeitronError {
  constructor(message = 'Resource expired or already consumed', code: string | number = 'GONE', details?: unknown) {
    super(410, message, code, details);
    this.name = 'ExpiredError';
    Object.setPrototypeOf(this, ExpiredError.prototype);
  }
}

export class ValidationError extends AeitronError {
  public readonly validationErrors?: Record<string, unknown>;

  constructor(
    message = 'Validation failed',
    code: string | number = 'VALIDATION_ERROR',
    details?: unknown,
    status = 400
  ) {
    super(status, message, code, details);
    this.name = 'ValidationError';
    if (typeof details === 'object' && details !== null) {
      this.validationErrors = details as Record<string, unknown>;
    }
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class RateLimitError extends AeitronError {
  public readonly retryAfterSeconds?: number;

  constructor(message = 'Rate limit exceeded', retryAfterSeconds?: number, code: string | number = 'RATE_LIMIT_EXCEEDED', details?: unknown) {
    super(429, message, code, details);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ServerError extends AeitronError {
  constructor(status = 500, message = 'Internal server error', code: string | number = 'SERVER_ERROR', details?: unknown) {
    super(status, message, code, details);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class NetworkError extends AeitronError {
  constructor(message = 'Network error', code: string | number = 'NETWORK_ERROR', details?: unknown) {
    super(0, message, code, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class WebhookSignature {
  public static readonly DEFAULT_TOLERANCE_SECONDS = 300;

  public static verify(
    payload: string,
    signatureHeader: string,
    secret: string,
    toleranceSeconds = WebhookSignature.DEFAULT_TOLERANCE_SECONDS
  ): boolean {
    if (!secret || typeof secret !== 'string') {
      throw new ValidationError('Webhook secret must be a non-empty string');
    }
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new ValidationError('Invalid webhook signature header format');
    }

    const items = signatureHeader.split(',');
    let timestamp: number | null = null;
    const signatures: string[] = [];

    for (const item of items) {
      const [k, v] = item.trim().split('=', 2);
      if (k === 't') {
        timestamp = parseInt(v, 10);
      } else if (k === 'v1') {
        signatures.push(v);
      }
    }

    if (timestamp === null || isNaN(timestamp) || signatures.length === 0) {
      throw new ValidationError('Invalid webhook signature header format. Expected "t=<timestamp>,v1=<sig>"');
    }

    const now = Math.floor(Date.now() / 1000);
    if (toleranceSeconds > 0 && Math.abs(now - timestamp) > toleranceSeconds) {
      throw new ValidationError(`Webhook signature timestamp outside acceptable tolerance (${toleranceSeconds}s). Potential replay attack.`);
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    for (const sig of signatures) {
      const sigBuf = Buffer.from(sig, 'utf-8');
      const expBuf = Buffer.from(expectedSig, 'utf-8');
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    }

    throw new AuthenticationError('Webhook signature verification failed. Computed signature does not match header.');
  }
}

export class AeitronClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  public readonly inference: InferenceNamespace;
  public readonly domains: DomainsNamespace;
  public readonly telemetry: TelemetryNamespace;
  public readonly gateway: GatewayNamespace;
  public readonly catalog: CatalogNamespace;
  public readonly orders: OrdersNamespace;
  public readonly invoices: InvoicesNamespace;
  public readonly domainCatalog: DomainCatalogNamespace;
  public readonly dns: DNSNamespace;
  public readonly compute: ComputeNamespace;
  public readonly databases: DatabasesNamespace;
  public readonly webhooks: WebhooksNamespace;
  public readonly fleet: FleetNamespace;
  public readonly audit: AuditNamespace;

  constructor(options: AeitronClientOptions) {
    if (!options || !options.apiKey || typeof options.apiKey !== 'string') {
      throw new ValidationError('AeitronClient requires a valid API key (e.g., nke_live_...)', 'INVALID_API_KEY');
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl || 'https://dashboard.aeitron.com').replace(/\/+$/, '');
    this.apiVersion = (options.apiVersion || '2026-11-01').trim();
    this.timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 30000;
    this.maxRetries = options.maxRetries !== undefined ? Math.max(0, options.maxRetries) : 2;
    this.defaultHeaders = options.defaultHeaders || {};
    this.fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch : globalThis.fetch);

    if (!this.fetchImpl) {
      throw new ServerError(500, 'Global fetch implementation not found. Provide options.fetch.', 'NO_FETCH');
    }

    this.inference = new InferenceNamespace(this);
    this.domains = new DomainsNamespace(this);
    this.telemetry = new TelemetryNamespace(this);
    this.gateway = new GatewayNamespace(this);
    this.catalog = new CatalogNamespace(this);
    this.orders = new OrdersNamespace(this);
    this.invoices = new InvoicesNamespace(this);
    this.domainCatalog = new DomainCatalogNamespace(this);
    this.dns = new DNSNamespace(this);
    this.compute = new ComputeNamespace(this);
    this.databases = new DatabasesNamespace(this);
    this.webhooks = new WebhooksNamespace(this);
    this.fleet = new FleetNamespace(this);
    this.audit = new AuditNamespace(this);
  }

  public async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      idempotencyKey?: string;
    } = {}
  ): Promise<{ data: T; headers: Headers }> {
    const method = (options.method || 'GET').toUpperCase();
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey,
      'Aeitron-Version': this.apiVersion,
      ...this.defaultHeaders,
      ...options.headers
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const isIdempotent =
      ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'].includes(method) ||
      !!options.idempotencyKey ||
      !!headers['Idempotency-Key'] ||
      !!headers['idempotency-key'];

    const maxAttempts = (isIdempotent ? this.maxRetries : 0) + 1;
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal
        });

        clearTimeout(timer);

        const responseText = await response.text();
        let responseJson: any = null;
        if (responseText) {
          try {
            responseJson = JSON.parse(responseText);
          } catch {
            responseJson = { raw: responseText };
          }
        }

        if (response.ok) {
          return {
            data: responseJson as T,
            headers: response.headers
          };
        }

        // Retryable status codes on idempotent requests
        if (attempt < maxAttempts && (response.status === 429 || (response.status >= 500 && response.status <= 504))) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
          await this.backoff(attempt, retryAfter);
          continue;
        }

        const message = String(
          (responseJson && (responseJson.error || responseJson.message || responseJson.error_description)) ||
          `HTTP ${response.status} ${response.statusText}`
        );
        const code = (responseJson && (responseJson.code || responseJson.error_code)) || response.status;

        // Dual-Control DNS Deletion / Safety Challenge Detection
        if (/del_req_[a-f0-9]+/i.test(message) || (responseJson && responseJson.requestId)) {
          const challengeReqId = String(responseJson?.requestId || message.match(/del_req_[a-f0-9]+/i)?.[0]);
          throw new ApprovalRequiredError(message, challengeReqId, responseJson?.domain, responseJson?.recordId, responseJson);
        }

        switch (response.status) {
          case 400:
            throw new ValidationError(message, code, responseJson, 400);
          case 401:
            throw new AuthenticationError(message, code, responseJson);
          case 403:
            throw new PermissionDeniedError(message, code, responseJson);
          case 404:
            throw new NotFoundError(message, code, responseJson);
          case 409:
            throw new ConflictError(message, code, responseJson);
          case 410:
            throw new ExpiredError(message, code, responseJson);
          case 422:
            throw new ValidationError(message, code, responseJson, 422);
          case 429: {
            const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
            throw new RateLimitError(message, retryAfter > 0 ? retryAfter : undefined, code, responseJson);
          }
          default:
            if (response.status >= 500) {
              throw new ServerError(response.status, message, code, responseJson);
            }
            throw new AeitronError(response.status, message, code, responseJson);
        }
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (err instanceof AeitronError) {
          throw err;
        }
        if (err.name === 'AbortError') {
          if (isIdempotent && attempt < maxAttempts) {
            await this.backoff(attempt, 0);
            continue;
          }
          throw new NetworkError(`Request timed out after ${this.timeoutMs}ms`, 'TIMEOUT');
        }
        if (isIdempotent && attempt < maxAttempts) {
          await this.backoff(attempt, 0);
          continue;
        }
        throw new NetworkError(err.message || 'Network request failed', 'NETWORK_ERROR');
      }
    }

    throw lastError || new ServerError(500, 'Max retry limit reached without response');
  }

  private async backoff(attempt: number, retryAfterSeconds: number): Promise<void> {
    if (retryAfterSeconds > 0) {
      await new Promise(r => setTimeout(r, retryAfterSeconds * 1000));
      return;
    }
    const delay = Math.min(1500, 50 * Math.pow(2, attempt - 1));
    const jitter = Math.random() * delay * 0.3;
    await new Promise(r => setTimeout(r, delay + jitter));
  }
}

class InferenceNamespace {
  constructor(private readonly client: AeitronClient) {}

  public async createCompletion(params: CompletionRequest, idempotencyKey?: string): Promise<CompletionResponse> {
    if (!params || !params.messages || !Array.isArray(params.messages)) {
      throw new ValidationError('CompletionRequest requires a messages array', 'INVALID_PARAMS');
    }

    const extraHeaders: Record<string, string> = {};
    if (params.routingStrategy) {
      extraHeaders['X-Aeitron-Routing-Strategy'] = params.routingStrategy;
    }
    if (params.jurisdiction) {
      extraHeaders['X-Aeitron-Jurisdiction'] = params.jurisdiction;
    }

    const payload = {
      model: params.model || 'meta-llama/Llama-3.3-70B-Instruct',
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024
    };

    const res = await this.client.request<any>('/api/proxy/inference', {
      method: 'POST',
      headers: extraHeaders,
      body: payload,
      idempotencyKey
    });

    const headers = res.headers;
    const data = res.data;

    const costHeader = headers.get('x-aeitron-cost');
    const ttftHeader = headers.get('x-aeitron-ttft-ms');

    const telemetry: CompletionTelemetry = {
      provider: headers.get('x-aeitron-provider') || null,
      cost: costHeader !== null ? parseFloat(costHeader) : null,
      ttftMs: ttftHeader !== null ? parseInt(ttftHeader, 10) : null,
      region: headers.get('x-aeitron-region') || null
    };

    return {
      id: data.id,
      object: data.object || 'chat.completion',
      created: data.created || Math.floor(Date.now() / 1000),
      model: data.model || params.model,
      choices: data.choices || [],
      usage: data.usage,
      telemetry
    };
  }
}

class DomainsNamespace {
  constructor(private readonly client: AeitronClient) {}

  public async list(): Promise<{ domains: DomainRecord[] }> {
    const res = await this.client.request<{ domains: DomainRecord[] }>('/api/proxy/domains', {
      method: 'GET'
    });
    return res.data;
  }

  public async onboard(params: OnboardDomainParams): Promise<OnboardDomainResult> {
    if (!params || !params.hostname || !params.originAddress) {
      throw new AeitronError(400, 'OnboardDomainParams requires hostname and originAddress', 'INVALID_PARAMS');
    }

    const payload = {
      hostname: params.hostname.trim().toLowerCase(),
      origin_address: params.originAddress.trim(),
      origin_port: params.originPort || 443,
      origin_protocol: params.originProtocol || 'https',
      allowed_pops: params.allowedPoPs || ['dhaka', 'singapore', 'frankfurt', 'virginia']
    };

    const res = await this.client.request<OnboardDomainResult>('/api/proxy/domains', {
      method: 'POST',
      body: payload
    });
    return res.data;
  }

  public async get(domainId: string): Promise<DomainRecord> {
    if (!domainId) {
      throw new AeitronError(400, 'domainId is required', 'INVALID_PARAMS');
    }
    const res = await this.client.request<DomainRecord>(`/api/proxy/domains/${encodeURIComponent(domainId)}`, {
      method: 'GET'
    });
    return res.data;
  }

  public async verify(domainId: string, options: { force?: boolean } = {}): Promise<VerifyDomainResult> {
    if (!domainId) {
      throw new AeitronError(400, 'domainId is required', 'INVALID_PARAMS');
    }
    const query = options.force ? '?force=true' : '';
    const res = await this.client.request<VerifyDomainResult>(
      `/api/proxy/domains/${encodeURIComponent(domainId)}/verify${query}`,
      { method: 'POST' }
    );
    return res.data;
  }

  public async delete(domainId: string): Promise<{ status: string; domain_id: string }> {
    if (!domainId) {
      throw new AeitronError(400, 'domainId is required', 'INVALID_PARAMS');
    }
    const res = await this.client.request<{ status: string; domain_id: string }>(
      `/api/proxy/domains/${encodeURIComponent(domainId)}`,
      { method: 'DELETE' }
    );
    return res.data;
  }
}

class TelemetryNamespace {
  constructor(private readonly client: AeitronClient) {}

  public async getSummary(projectId?: string): Promise<TelemetrySummary> {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    const res = await this.client.request<TelemetrySummary>(`/api/proxy/analytics/summary${query}`, {
      method: 'GET'
    });
    return res.data;
  }

  public async getLatencyMatrix(): Promise<LatencyMatrixResult> {
    const res = await this.client.request<LatencyMatrixResult>('/api/proxy/pops/matrix', {
      method: 'GET'
    });
    return res.data;
  }

  public async getPoPHealth(): Promise<{ pops: PoPHealthRecord[] }> {
    const res = await this.client.request<{ pops: PoPHealthRecord[] }>('/api/proxy/pops/health', {
      method: 'GET'
    });
    return res.data;
  }
}
