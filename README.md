# Aeitron TypeScript SDK

The official, zero-dependency TypeScript client for the **Aeitron** Global Infrastructure & AI Orchestration API.

## Features

- **Zero Runtime Dependencies:** Uses native Web Fetch API and standard ESM.
- **Strictly Typed:** Comprehensive TypeScript definitions with full IntelliSense support.
- **Multi-Objective AI Orchestration:** Integrated support for latency-optimal, cost-minimal, carbon-neutral, and sovereign-pinned inference routing.
- **Full Infrastructure Namespaces:** Manage Domains, DNS, Gateway, Compute, Fleet, Databases, Orders, and Invoices.
- **Predictive Telemetry:** Real-time metrics and edge PoP health inspection.

## Installation

```bash
npm install @aeitron/api-client
```

Or using pnpm / yarn:

```bash
pnpm add @aeitron/api-client
# or
yarn add @aeitron/api-client
```

## Quickstart

### 1. Initialize the Client

```typescript
import { AeitronClient } from '@aeitron/api-client';

const client = new AeitronClient({
  apiKey: process.env.AEITRON_API_KEY || 'your_api_key_here',
  // Optional base URL override (defaults to https://api.aeitron.com)
  baseUrl: 'https://api.aeitron.com',
  timeoutMs: 15000
});
```

### 2. Multi-Objective AI Inference

```typescript
const response = await client.inference.createCompletion({
  model: 'meta-llama/Llama-3-70b-Instruct',
  messages: [
    { role: 'system', content: 'You are a helpful infrastructure assistant.' },
    { role: 'user', content: 'What is Anycast routing?' }
  ],
  routingStrategy: 'LATENCY_OPTIMAL', // or 'COST_MINIMAL', 'CARBON_NEUTRAL', 'SOVEREIGN_PINNED'
  jurisdiction: 'GLOBAL'
});

console.log('AI Response:', response.choices[0].message.content);
console.log('Telemetry:', response.telemetry);
```

### 3. Edge Domain Onboarding & Verification

```typescript
// Onboard a custom domain
const onboardResult = await client.domains.onboardDomain({
  hostname: 'api.example.com',
  originAddress: '203.0.113.10',
  originPort: 443,
  originProtocol: 'https',
  allowedPoPs: ['bd-dac', 'sg-sin', 'de-fra', 'us-iad']
});

console.log('CNAME Target:', onboardResult.cname_target);
console.log('Verification Token:', onboardResult.verification_token);

// Verify domain ownership
const verification = await client.domains.verifyDomain(onboardResult.domain_id);
console.log('Status:', verification.status);
```

### 4. Edge PoP Telemetry & Health

```typescript
const health = await client.telemetry.getPopHealth();
console.log('PoP Health Status:', health);
```

## Available Namespaces

The SDK provides organized access to all Aeitron control-plane and data-plane resources:

| Namespace | Description |
| :--- | :--- |
| `client.inference` | AI model routing, multi-objective completion, and streaming |
| `client.domains` | Custom edge domain onboarding, verification, and origin routing |
| `client.dns` | DNS zone management and record modification |
| `client.gateway` | Edge gateway routes, TLS certificates, and WAF rulesets |
| `client.compute` | MicroVM workload deployment and serverless containers |
| `client.telemetry` | PoP metrics, edge latency matrices, and global health |
| `client.fleet` | Edge server inventory and infrastructure node telemetry |
| `client.orders` | Resource ordering, domain registration, and quota management |
| `client.invoices` | Billing history, invoices, and payment receipts |

## Error Handling

All API errors throw an `AeitronError` with HTTP status code and error details:

```typescript
import { AeitronClient, AeitronError } from '@aeitron/api-client';

try {
  await client.domains.getDomain('non-existent-domain-id');
} catch (error) {
  if (error instanceof AeitronError) {
    console.error(`Aeitron API Error (${error.status}):`, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Development and Testing

```bash
# Clone the repository
git clone https://github.com/aeitron/api-typescript-sdk.git
cd api-typescript-sdk

# Install development dependencies
npm install

# Typecheck and build
npm run build

# Run test suite
npm test
```

## License

MIT License. See [LICENSE](LICENSE) for details.
