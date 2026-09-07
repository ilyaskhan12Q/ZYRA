/**
 * Custom error hierarchy for Lighthouse execution
 */

export class LighthouseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'LighthouseError';
    if (cause && cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class InvalidUrlError extends LighthouseError {
  constructor(public readonly url: string, reason: string) {
    super(`Invalid target URL '${url}': ${reason}`);
    this.name = 'InvalidUrlError';
  }
}

export class ChromeLaunchError extends LighthouseError {
  constructor(message: string, cause?: unknown) {
    super(`Failed to launch Chrome browser: ${message}`, cause);
    this.name = 'ChromeLaunchError';
  }
}

export class LighthouseTimeoutError extends LighthouseError {
  constructor(public readonly timeoutMs: number) {
    super(`Lighthouse measurement timed out after ${timeoutMs / 1000}s.`);
    this.name = 'LighthouseTimeoutError';
  }
}

export class LighthouseExecutionError extends LighthouseError {
  constructor(message: string, cause?: unknown) {
    super(`Lighthouse audit execution failed: ${message}`, cause);
    this.name = 'LighthouseExecutionError';
  }
}
