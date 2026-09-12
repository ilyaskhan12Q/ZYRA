import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { MeasurementProgress, createMeasurementProgress } from '../../src/cli/progress.js';
import { LighthouseTimeoutError, LighthouseExecutionError } from '../../src/lighthouse/errors.js';

class MockStream extends Writable {
  public chunks: string[] = [];

  public override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(chunk.toString());
    callback();
  }

  public get output(): string {
    return this.chunks.join('');
  }

  public clear(): void {
    this.chunks = [];
  }
}

describe('CLI — Measurement Progress UX (Unit)', () => {
  it('does not emit any output when isJson is true', () => {
    const mock = new MockStream();
    const progress = createMeasurementProgress({
      url: 'https://example.com',
      device: 'mobile',
      isJson: true,
      stream: mock as any
    });

    progress.start('Launching Chrome browser...');
    progress.update('Running Lighthouse audit...');
    progress.succeed();
    progress.fail(new Error('test failure'));

    assert.equal(mock.output, '');
    assert.equal(mock.chunks.length, 0);
  });

  it('renders deterministic start, updates, and completion in non-TTY mode', () => {
    const mock = new MockStream();
    const progress = createMeasurementProgress({
      url: 'https://example.com/test',
      device: 'desktop',
      timeoutMs: 30000,
      isJson: false,
      isTTY: false,
      stream: mock as any
    });

    progress.start('Launching Chrome browser...');
    assert.ok(mock.output.includes('Measuring performance for https://example.com/test [desktop] (timeout: 30s)'));
    assert.ok(mock.output.includes('→ Launching Chrome browser...'));

    progress.update('Running Lighthouse audit...');
    assert.ok(mock.output.includes('→ Running Lighthouse audit...'));

    progress.update('Processing & validating evidence...');
    assert.ok(mock.output.includes('→ Processing & validating evidence...'));

    progress.succeed();
    assert.ok(mock.output.includes('✔ Measurement completed in'));

    // Verify no fake percentages or invented numbers
    assert.ok(!mock.output.includes('%'));
  });

  it('renders interactive in-place spinner frames with elapsed time in TTY mode', async () => {
    const mock = new MockStream();
    const progress = new MeasurementProgress({
      url: 'https://example.com/interactive',
      device: 'mobile',
      timeoutMs: 45000,
      isJson: false,
      isTTY: true,
      tickIntervalMs: 20,
      stream: mock as any
    });

    progress.start('Launching Chrome browser...');
    assert.ok(mock.output.includes('Measuring performance for https://example.com/interactive [mobile]'));
    assert.ok(mock.output.includes('\r\x1b[K'));
    assert.ok(mock.output.includes('Measuring performance [mobile] → Launching Chrome browser...'));

    // Wait for at least one timer tick to render live elapsed time
    await new Promise((resolve) => setTimeout(resolve, 50));

    progress.update('Running Lighthouse audit...');
    assert.ok(mock.output.includes('Measuring performance [mobile] → Running Lighthouse audit...'));

    progress.succeed();
    assert.ok(mock.output.includes('\r\x1b[K✔ Measurement completed in'));

    // Ensure timer was cleaned up
    progress.stop();
  });

  it('formats timeout state accurately with elapsed time', () => {
    const mock = new MockStream();
    const progress = createMeasurementProgress({
      url: 'https://example.com/timeout',
      device: 'mobile',
      timeoutMs: 30000,
      isJson: false,
      isTTY: false,
      stream: mock as any
    });

    progress.start();
    const timeoutErr = new LighthouseTimeoutError(30000);
    progress.fail(timeoutErr);

    assert.ok(mock.output.includes('✖ Measurement timed out after'));
    assert.ok(!mock.output.includes('✔ Measurement completed'));
  });

  it('formats failure state accurately with elapsed time and message', () => {
    const mock = new MockStream();
    const progress = createMeasurementProgress({
      url: 'https://example.com/failure',
      device: 'mobile',
      timeoutMs: 30000,
      isJson: false,
      isTTY: false,
      stream: mock as any
    });

    progress.start();
    const execErr = new LighthouseExecutionError('Chrome crashed unexpectedly');
    progress.fail(execErr);

    assert.ok(mock.output.includes('✖ Measurement failed after'));
  });

  it('guards against calls before start or multiple completions', () => {
    const mock = new MockStream();
    const progress = createMeasurementProgress({
      url: 'https://example.com',
      device: 'mobile',
      isJson: false,
      isTTY: false,
      stream: mock as any
    });

    // Calling succeed or fail before start should not output anything
    progress.succeed();
    assert.equal(mock.output, '');
    progress.fail(new Error('premature'));
    assert.equal(mock.output, '');

    progress.start();
    const outputAfterStart = mock.output;
    progress.succeed();
    const outputAfterSucceed = mock.output;
    assert.ok(outputAfterSucceed.length > outputAfterStart.length);

    // Subsequent succeed or fail should be no-ops
    progress.succeed();
    progress.fail(new Error('after stop'));
    assert.equal(mock.output, outputAfterSucceed);
  });
});
