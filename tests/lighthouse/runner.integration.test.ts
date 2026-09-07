import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { collectEvidence } from '../../src/evidence/collector.js';

describe('Lighthouse Runner — Real Browser Integration Test', () => {
  it('executes real Lighthouse measurement against a local server and normalizes evidence', async () => {
    // Spin up local HTTP server
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Integration Test Page</title>
  <style>h1 { color: navy; font-family: sans-serif; }</style>
</head>
<body>
  <h1>ZYRA Integration Test</h1>
  <p>Real Lighthouse runner integration verification.</p>
</body>
</html>`);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 8080;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const { evidence, rawLhr } = await collectEvidence({
        url: testUrl,
        device: 'mobile',
        timeoutMs: 45000,
        includeRawLhr: true
      });

      // 1. Evidence structure
      assert.equal(evidence.schemaVersion, '1.0');
      assert.equal(evidence.target.device, 'mobile');
      assert.equal(evidence.target.url, testUrl);

      // 2. Metrics (must be real numbers from browser run)
      assert.ok(typeof evidence.metrics.fcp.value === 'number');
      assert.ok(evidence.metrics.fcp.value! >= 0);
      assert.equal(evidence.metrics.fcp.unit, 'ms');

      assert.ok(typeof evidence.metrics.lcp.value === 'number');
      assert.ok(evidence.metrics.lcp.value! >= 0);
      assert.equal(evidence.metrics.lcp.unit, 'ms');

      assert.ok(typeof evidence.metrics.cls.value === 'number');
      assert.ok(evidence.metrics.cls.value! >= 0);
      assert.equal(evidence.metrics.cls.unit, 'score');

      assert.ok(typeof evidence.metrics.tbt.value === 'number');
      assert.ok(evidence.metrics.tbt.value! >= 0);
      assert.equal(evidence.metrics.tbt.unit, 'ms');

      // 3. Performance Score
      assert.ok(typeof evidence.scores.performance === 'number');
      assert.ok(evidence.scores.performance! >= 0 && evidence.scores.performance! <= 1);

      // 4. Audits & Resources
      assert.ok(evidence.audits.length > 10);
      assert.ok(evidence.resources.summary.length > 0);
      assert.ok(evidence.network.requests.length > 0);

      // 5. Raw result preserved when requested
      assert.ok(rawLhr);
      assert.ok(rawLhr.audits);
    } finally {
      server.close();
    }
  });
});
