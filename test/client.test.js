const { describe, it } = require('node:test');
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const {
  AeitronClient,
  AeitronError,
  AuthenticationError,
  PermissionDeniedError,
  ApprovalRequiredError,
  NotFoundError,
  ConflictError,
  ExpiredError,
  ValidationError,
  RateLimitError,
  ServerError,
  NetworkError,
  WebhookSignature
} = require('../dist/index.js');

function safeClose(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
    server.close(() => resolve());
  });
}

describe('Aeitron Official TypeScript SDK Acceptance Tests', () => {
  it('Requirement SDK.1: Client rejects missing or empty API keys', () => {
    assert.throws(
      () => new AeitronClient({ apiKey: '' }),
      (err) => err instanceof AeitronError && err.status === 400 && err.code === 'INVALID_API_KEY'
    );
    assert.throws(
      () => new AeitronClient(null),
      (err) => err instanceof AeitronError && err.status === 400
    );
  });

  it('Requirement SDK.2: Inference createCompletion dispatches multi-objective routing & parses telemetry', async () => {
    let capturedHeaders = null;
    let capturedBody = null;

    const mockServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/proxy/inference') {
        capturedHeaders = req.headers;
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          capturedBody = JSON.parse(body);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Aeitron-Provider': 'spot-coreweave',
            'X-Aeitron-Cost': '0.0042',
            'X-Aeitron-TTFT-Ms': '24',
            'X-Aeitron-Region': 'dhaka'
          });
          res.end(JSON.stringify({
            id: 'chatcmpl-test-001',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Latency-optimal inference complete.' }
            }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_test_secret_12345',
        baseUrl: `http://127.0.0.1:${port}`
      });

      const response = await client.inference.createCompletion({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        messages: [{ role: 'user', content: 'Status check' }],
        routingStrategy: 'LATENCY_OPTIMAL',
        jurisdiction: 'BD',
        temperature: 0.2
      });

      assert.strictEqual(response.id, 'chatcmpl-test-001');
      assert.strictEqual(response.choices[0].message.content, 'Latency-optimal inference complete.');
      assert.strictEqual(response.telemetry.provider, 'spot-coreweave');
      assert.strictEqual(response.telemetry.cost, 0.0042);
      assert.strictEqual(response.telemetry.ttftMs, 24);
      assert.strictEqual(response.telemetry.region, 'dhaka');

      assert.strictEqual(capturedHeaders['authorization'], 'Bearer nke_live_test_secret_12345');
      assert.strictEqual(capturedHeaders['x-aeitron-routing-strategy'], 'LATENCY_OPTIMAL');
      assert.strictEqual(capturedHeaders['x-aeitron-jurisdiction'], 'BD');
      assert.strictEqual(capturedBody.model, 'meta-llama/Llama-3.3-70B-Instruct');
      assert.strictEqual(capturedBody.temperature, 0.2);
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.3: Domains namespace handles onboarding, verification, and deletion', async () => {
    let lastUrl = '';
    let lastMethod = '';
    let lastBody = null;

    const mockServer = http.createServer((req, res) => {
      lastUrl = req.url;
      lastMethod = req.method;

      if (req.method === 'GET' && req.url === '/api/proxy/domains') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          domains: [{ id: 'dom-01', project_id: 'proj-alpha', hostname: 'api.alpha.com', status: 'verified' }]
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/proxy/domains') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          lastBody = JSON.parse(body);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            domain_id: 'dom-new-99',
            hostname: lastBody.hostname,
            cname_target: 'dom-new-99.edge.aeitron.net',
            verification_token: 'nke-verify-token-99',
            status: 'pending_verification',
            allowed_pops: lastBody.allowed_pops
          }));
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/proxy/domains/dom-new-99/verify?force=true') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'verified',
          domain_id: 'dom-new-99',
          hostname: 'beta.app.com',
          state: 'active'
        }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/api/proxy/domains/dom-new-99') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'deleted', domain_id: 'dom-new-99' }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_domain_test_key',
        baseUrl: `http://127.0.0.1:${port}`
      });

      // 1. List
      const listRes = await client.domains.list();
      assert.strictEqual(listRes.domains.length, 1);
      assert.strictEqual(listRes.domains[0].hostname, 'api.alpha.com');

      // 2. Onboard
      const onboardRes = await client.domains.onboard({
        hostname: 'beta.app.com',
        originAddress: '198.51.100.25',
        originPort: 443,
        originProtocol: 'https'
      });
      assert.strictEqual(onboardRes.domain_id, 'dom-new-99');
      assert.strictEqual(onboardRes.cname_target, 'dom-new-99.edge.aeitron.net');
      assert.strictEqual(lastBody.hostname, 'beta.app.com');

      // 3. Verify
      const verifyRes = await client.domains.verify('dom-new-99', { force: true });
      assert.strictEqual(verifyRes.status, 'verified');
      assert.strictEqual(verifyRes.state, 'active');

      // 4. Delete
      const deleteRes = await client.domains.delete('dom-new-99');
      assert.strictEqual(deleteRes.status, 'deleted');
      assert.strictEqual(lastMethod, 'DELETE');
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.4: Telemetry namespace queries summary, matrix, and PoP health', async () => {
    let capturedSummaryUrl = '';

    const mockServer = http.createServer((req, res) => {
      if (req.url.startsWith('/api/proxy/analytics/summary')) {
        capturedSummaryUrl = req.url;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          project_id: 'proj-core',
          total_requests: 12450,
          p50_latency_ms: 3.8,
          p95_latency_ms: 16.4,
          p99_latency_ms: 28.1,
          cache_hit_ratio: 0.942,
          threat_blocks: 14,
          success_rate: 0.998,
          status_distribution: { '2xx': 12420, '4xx': 25, '5xx': 5 },
          pop_distribution: { dhaka: 6200, singapore: 4100, frankfurt: 1500, virginia: 650 }
        }));
        return;
      }

      if (req.url === '/api/proxy/pops/matrix') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          routes: [{ from_pop: 'dhaka', to_pop: 'singapore', latency_ms: 32 }]
        }));
        return;
      }

      if (req.url === '/api/proxy/pops/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          pops: [{ id: 'pop-dhk-01', name: 'Dhaka Edge 01', region: 'dhaka', status: 'ONLINE', latency_p50_ms: 2.1, capacity_used_pct: 34, anycast_announced: true }]
        }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_telemetry_key',
        baseUrl: `http://127.0.0.1:${port}`
      });

      const summary = await client.telemetry.getSummary('proj-analytics-test');
      assert.strictEqual(summary.total_requests, 12450);
      assert.strictEqual(summary.p99_latency_ms, 28.1);
      assert.strictEqual(summary.threat_blocks, 14);
      assert.strictEqual(capturedSummaryUrl, '/api/proxy/analytics/summary?project_id=proj-analytics-test');

      const matrix = await client.telemetry.getLatencyMatrix();
      assert.strictEqual(matrix.routes.length, 1);
      assert.strictEqual(matrix.routes[0].latency_ms, 32);

      const health = await client.telemetry.getPoPHealth();
      assert.strictEqual(health.pops.length, 1);
      assert.strictEqual(health.pops[0].region, 'dhaka');
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.5: HTTP error responses throw AeitronError with status and message', async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 403,
        error: 'Forbidden: Insufficient role permissions for this resource'
      }));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_unauthorized_key',
        baseUrl: `http://127.0.0.1:${port}`
      });

      await assert.rejects(
        () => client.domains.delete('dom-restricted'),
        (err) => {
          assert.strictEqual(err instanceof AeitronError, true);
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 403);
          assert.strictEqual(err.message.includes('Insufficient role permissions'), true);
          return true;
        }
      );
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.6: Auto-generated OpenAPI namespaces (Catalog, Orders, DNS, Compute, Databases, Webhooks)', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockServer = http.createServer((req, res) => {
      capturedUrl = req.url;
      capturedMethod = req.method;

      if (req.url === '/v1/catalog' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          products: [{ id: 'prod_vps_m', name: 'Standard VPS Medium', price_cents: 2000, category: 'compute' }]
        }));
        return;
      }

      if (req.url === '/v1/dns/zones' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          zones: [{ id: 'zone_01', name: 'aeitron.cloud', status: 'ACTIVE', record_count: 5 }]
        }));
        return;
      }

      if (req.url === '/v1/compute/instances' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          instances: [{ id: 'inst_01', name: 'edge-worker-01', type: 'vps', region: 'dhaka', status: 'ACTIVE', vcpus: 4, memory_mb: 8192, disk_gb: 100, created_at: '2026-10-28T00:00:00Z' }]
        }));
        return;
      }

      if (req.url === '/v1/databases/instances' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          instances: [{ id: 'db_01', name: 'prod-pg-dhaka', engine: 'postgresql', status: 'ACTIVE', version: '16' }]
        }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_test_secret_12345',
        baseUrl: `http://127.0.0.1:${port}`
      });

      const catalogRes = await client.catalog.listProducts();
      assert.strictEqual(catalogRes.products.length, 1);
      assert.strictEqual(catalogRes.products[0].id, 'prod_vps_m');
      assert.strictEqual(capturedUrl, '/v1/catalog');
      assert.strictEqual(capturedMethod, 'GET');

      const dnsRes = await client.dns.listZones();
      assert.strictEqual(dnsRes.zones.length, 1);
      assert.strictEqual(dnsRes.zones[0].name, 'aeitron.cloud');

      const computeRes = await client.compute.listInstances();
      assert.strictEqual(computeRes.instances.length, 1);
      assert.strictEqual(computeRes.instances[0].region, 'dhaka');

      const dbRes = await client.databases.listInstances();
      assert.strictEqual(dbRes.instances.length, 1);
      assert.strictEqual(dbRes.instances[0].name, 'prod-pg-dhaka');
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.7: Date-based API versioning header and deprecation detection', async () => {
    let capturedVersionHeader = null;

    const mockServer = http.createServer((req, res) => {
      capturedVersionHeader = req.headers['aeitron-version'];
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Aeitron-Version': capturedVersionHeader,
        'X-Aeitron-Deprecation-Date': '2027-01-01',
        'Sunset': 'Fri, 01 Jan 2027 00:00:00 GMT'
      });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      // 1. Default version (2026-11-01)
      const defaultClient = new AeitronClient({
        apiKey: 'nke_live_test_secret_12345',
        baseUrl: `http://127.0.0.1:${port}`
      });

      const res1 = await defaultClient.request('/v1/status');
      assert.strictEqual(capturedVersionHeader, '2026-11-01');
      assert.strictEqual(res1.headers.get('x-aeitron-deprecation-date'), '2027-01-01');

      // 2. Custom pinned version
      const legacyClient = new AeitronClient({
        apiKey: 'nke_live_test_secret_12345',
        baseUrl: `http://127.0.0.1:${port}`,
        apiVersion: '2026-01-01'
      });

      await legacyClient.request('/v1/status');
      assert.strictEqual(capturedVersionHeader, '2026-01-01');
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.8: Specialized typed error hierarchy maps HTTP status codes accurately', async () => {
    let returnStatus = 401;
    let returnPayload = { error: 'UNAUTHORIZED', message: 'Token expired' };

    const mockServer = http.createServer((req, res) => {
      res.writeHead(returnStatus, { 'Content-Type': 'application/json', 'Retry-After': '12' });
      res.end(JSON.stringify(returnPayload));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_test_key_123',
        baseUrl: `http://127.0.0.1:${port}`,
        maxRetries: 0
      });

      // 401 AuthenticationError
      returnStatus = 401;
      returnPayload = { error: 'UNAUTHORIZED', message: 'Invalid token' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof AuthenticationError && err.status === 401);

      // 403 PermissionDeniedError
      returnStatus = 403;
      returnPayload = { error: 'FORBIDDEN', message: 'Access denied' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof PermissionDeniedError && err.status === 403);

      // 404 NotFoundError
      returnStatus = 404;
      returnPayload = { error: 'NOT_FOUND', message: 'Zone not found' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof NotFoundError && err.status === 404);

      // 409 ConflictError
      returnStatus = 409;
      returnPayload = { error: 'CONFLICT', message: 'Domain already exists' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof ConflictError && err.status === 409);

      // 410 ExpiredError
      returnStatus = 410;
      returnPayload = { error: 'GONE', message: 'Challenge expired' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof ExpiredError && err.status === 410);

      // 422 ValidationError
      returnStatus = 422;
      returnPayload = { error: 'UNPROCESSABLE_ENTITY', message: 'Invalid IP format', fields: { ip: 'bad' } };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof ValidationError && err.status === 422);

      // 429 RateLimitError with retryAfterSeconds
      returnStatus = 429;
      returnPayload = { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' };
      await assert.rejects(
        async () => client.request('/v1/test'),
        (err) => err instanceof RateLimitError && err.status === 429 && err.retryAfterSeconds === 12
      );

      // 502 ServerError
      returnStatus = 502;
      returnPayload = { error: 'BAD_GATEWAY', message: 'Edge node offline' };
      await assert.rejects(async () => client.request('/v1/test'), (err) => err instanceof ServerError && err.status === 502);
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.9: Dual-control DNS deletion and operator approval workflow', async () => {
    let capturedApprovalHeader = null;
    let capturedUrl = null;

    const mockServer = http.createServer((req, res) => {
      capturedUrl = req.url;
      if (req.method === 'POST' && req.url === '/v1/dns/zones/zone-123/records/rec-456/deletion-request') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          requestId: 'del_req_dual_control_01',
          zoneId: 'zone-123',
          recordId: 'rec-456',
          expiresAt: Date.now() + 60000
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/dns/approve-deletion') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          approvalToken: 'del_tok_signature_token_789',
          requestId: 'del_req_dual_control_01',
          expiresAt: Date.now() + 60000
        }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/v1/dns/zones/zone-123/records/rec-456?confirm=true') {
        capturedApprovalHeader = req.headers['x-aeitron-approval-token'];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'deleted',
          record_id: 'rec-456'
        }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_agent_token',
        baseUrl: `http://127.0.0.1:${port}`
      });

      // 1. Initiator requests deletion
      const deletionReq = await client.dns.requestDeletion('zone-123', 'rec-456');
      assert.strictEqual(deletionReq.requestId, 'del_req_dual_control_01');

      // 2. Operator authorizes request
      const approval = await client.dns.approveDeletion(deletionReq.requestId);
      assert.strictEqual(approval.success, true);
      assert.strictEqual(approval.approvalToken, 'del_tok_signature_token_789');

      // 3. Client executes deletion with single-use token and confirmation
      const delResult = await client.dns.deleteRecord('zone-123', 'rec-456', {
        approvalToken: approval.approvalToken,
        confirm: true
      });
      assert.strictEqual(delResult.status, 'deleted');
      assert.strictEqual(capturedApprovalHeader, 'del_tok_signature_token_789');
      assert.ok(capturedUrl.includes('confirm=true'));
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.10: Challenge guard fail-closed triggers ApprovalRequiredError with requestId', async () => {
    const mockServer = http.createServer((req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'APPROVAL_REQUIRED',
        message: 'Destructive DNS deletion requires human operator approval. Request ID: del_req_safety_gate_999',
        requestId: 'del_req_safety_gate_999',
        domain: 'aeitron.com',
        recordId: 'rec_dns_01'
      }));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_agent_token',
        baseUrl: `http://127.0.0.1:${port}`,
        maxRetries: 0
      });

      await assert.rejects(
        async () => client.dns.deleteRecord('zone_01', 'rec_dns_01'),
        (err) => {
          assert.ok(err instanceof ApprovalRequiredError);
          assert.strictEqual(err.challengeRequestId, 'del_req_safety_gate_999');
          assert.strictEqual(err.domain, 'aeitron.com');
          assert.strictEqual(err.recordId, 'rec_dns_01');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.11: Webhook signature verification and replay protection', () => {
    const secret = 'whsec_test_secret_key_abcdef1234567890';
    const payload = JSON.stringify({ id: 'evt_01', type: 'domain.verified', data: { domain: 'aeitron.com' } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;

    // 1. Valid signature passes
    assert.strictEqual(WebhookSignature.verify(payload, header, secret), true);

    // 2. Forged signature throws AuthenticationError
    assert.throws(
      () => WebhookSignature.verify(payload, `t=${timestamp},v1=bad_hex_sig`, secret),
      (err) => err instanceof AuthenticationError
    );

    // 3. Expired timestamp outside tolerance throws ValidationError (anti-replay)
    const oldTimestamp = timestamp - 600;
    const oldSig = crypto.createHmac('sha256', secret).update(`${oldTimestamp}.${payload}`).digest('hex');
    assert.throws(
      () => WebhookSignature.verify(payload, `t=${oldTimestamp},v1=${oldSig}`, secret, 300),
      (err) => err instanceof ValidationError && err.message.includes('outside acceptable tolerance')
    );
  });

  it('Requirement SDK.12: Automatic retries with exponential backoff on transient 503 errors', async () => {
    let attempts = 0;
    const mockServer = http.createServer((req, res) => {
      attempts++;
      if (attempts === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service Unavailable' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ healthy: true, attempts }));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_test_key',
        baseUrl: `http://127.0.0.1:${port}`,
        maxRetries: 2
      });

      const res = await client.request('/v1/health');
      assert.strictEqual(res.data.healthy, true);
      assert.strictEqual(attempts, 2);
    } finally {
      await safeClose(mockServer);
    }
  });

  it('Requirement SDK.13: Idempotency-Key header is transmitted and enables retry on mutative requests', async () => {
    let capturedIdempKey = null;
    let attempts = 0;

    const mockServer = http.createServer((req, res) => {
      attempts++;
      capturedIdempKey = req.headers['idempotency-key'];
      if (attempts === 1) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Temporary Internal Error' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ created: true }));
    });

    await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const port = mockServer.address().port;

    try {
      const client = new AeitronClient({
        apiKey: 'nke_live_test_key',
        baseUrl: `http://127.0.0.1:${port}`,
        maxRetries: 2
      });

      const res = await client.request('/v1/deploy', {
        method: 'POST',
        body: { service: 'gateway' },
        idempotencyKey: 'idemp_key_custom_42'
      });

      assert.strictEqual(res.data.created, true);
      assert.strictEqual(capturedIdempKey, 'idemp_key_custom_42');
      assert.strictEqual(attempts, 2, 'POST with idempotencyKey must be safely retried on 500');
    } finally {
      await safeClose(mockServer);
    }
  });
});
