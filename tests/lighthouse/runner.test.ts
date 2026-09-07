import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateTargetUrl } from '../../src/lighthouse/runner.js';
import {
  InvalidUrlError,
  ChromeLaunchError,
  LighthouseTimeoutError,
  LighthouseExecutionError,
  LighthouseError
} from '../../src/lighthouse/errors.js';

describe('Lighthouse Runner — Validation & Errors', () => {
  it('accepts valid http and https URLs', () => {
    const u1 = validateTargetUrl('http://localhost:8080/test');
    assert.equal(u1.protocol, 'http:');
    assert.equal(u1.hostname, 'localhost');

    const u2 = validateTargetUrl('https://example.com/app?key=1');
    assert.equal(u2.protocol, 'https:');
    assert.equal(u2.hostname, 'example.com');
  });

  it('rejects empty or non-string URLs', () => {
    assert.throws(() => validateTargetUrl(''), InvalidUrlError);
    assert.throws(() => validateTargetUrl(null as any), InvalidUrlError);
    assert.throws(() => validateTargetUrl(undefined as any), InvalidUrlError);
  });

  it('rejects invalid or non-http(s) protocols', () => {
    assert.throws(
      () => validateTargetUrl('ftp://example.com'),
      (err: Error) => err instanceof InvalidUrlError && err.message.includes('unsupported')
    );
    assert.throws(
      () => validateTargetUrl('file:///etc/passwd'),
      (err: Error) => err instanceof InvalidUrlError && err.message.includes('unsupported')
    );
    assert.throws(
      () => validateTargetUrl('ws://example.com'),
      (err: Error) => err instanceof InvalidUrlError && err.message.includes('unsupported')
    );
  });

  it('properly structures custom error hierarchy', () => {
    const base = new LighthouseError('base');
    assert.ok(base instanceof Error);
    assert.equal(base.name, 'LighthouseError');

    const urlErr = new InvalidUrlError('invalid', 'bad format');
    assert.ok(urlErr instanceof LighthouseError);
    assert.equal(urlErr.name, 'InvalidUrlError');

    const launchErr = new ChromeLaunchError('no binary');
    assert.ok(launchErr instanceof LighthouseError);
    assert.equal(launchErr.name, 'ChromeLaunchError');

    const timeoutErr = new LighthouseTimeoutError(30000);
    assert.ok(timeoutErr instanceof LighthouseError);
    assert.equal(timeoutErr.name, 'LighthouseTimeoutError');

    const execErr = new LighthouseExecutionError('audit crashed');
    assert.ok(execErr instanceof LighthouseError);
    assert.equal(execErr.name, 'LighthouseExecutionError');
  });
});
