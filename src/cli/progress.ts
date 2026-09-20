import { type DeviceType } from '../lighthouse/types.js';
import { LighthouseTimeoutError } from '../lighthouse/errors.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface MeasurementProgressOptions {
  url: string;
  device?: DeviceType;
  timeoutMs?: number;
  isJson?: boolean;
  stream?: NodeJS.WriteStream;
  isTTY?: boolean;
  tickIntervalMs?: number;
  taskLabel?: string;
}

export class MeasurementProgress {
  private readonly url: string;
  private readonly device: DeviceType;
  private readonly timeoutMs: number;
  private readonly isJson: boolean;
  private readonly stream: NodeJS.WriteStream;
  private readonly isTTY: boolean;
  private readonly tickIntervalMs: number;
  private readonly taskLabel: string;

  private startTime: number = 0;
  private status: string = 'Launching Chrome browser...';
  private frameIndex: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor(options: MeasurementProgressOptions) {
    this.url = options.url;
    this.device = options.device ?? 'mobile';
    this.timeoutMs = options.timeoutMs ?? 90000;
    this.isJson = Boolean(options.isJson);
    this.stream = options.stream ?? process.stdout;
    this.isTTY = options.isTTY ?? Boolean(this.stream.isTTY);
    this.tickIntervalMs = options.tickIntervalMs ?? 100;
    this.taskLabel = options.taskLabel ?? 'Measuring performance';
  }

  public start(initialStatus?: string): void {
    if (this.isJson) {
      return;
    }

    this.startTime = Date.now();
    this.status = initialStatus ?? 'Launching Chrome browser...';
    this.stopped = false;
    this.frameIndex = 0;

    const timeoutSec = Math.round(this.timeoutMs / 1000);

    if (this.isTTY) {
      this.stream.write(`\n⏳ ${this.taskLabel} for ${this.url} [${this.device}] (timeout: ${timeoutSec}s)\n`);
      this.renderTTY();
      this.timer = setInterval(() => {
        this.renderTTY();
      }, this.tickIntervalMs);
      this.timer.unref();
    } else {
      this.stream.write(`\n⏳ ${this.taskLabel} for ${this.url} [${this.device}] (timeout: ${timeoutSec}s)...\n`);
      this.stream.write(`  → ${this.status}\n`);
    }
  }

  public update(status: string): void {
    if (this.stopped || this.isJson) {
      return;
    }

    this.status = status;

    if (this.isTTY) {
      this.renderTTY();
    } else {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      this.stream.write(`  → ${this.status} (${elapsed}s elapsed)\n`);
    }
  }

  public succeed(customMessage?: string): void {
    if (this.stopped || this.startTime === 0) {
      return;
    }

    this.stop();

    if (this.isJson) {
      return;
    }

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const message = customMessage ?? `✔ Measurement completed in ${elapsed}s`;

    if (this.isTTY) {
      this.stream.write(`\r\x1b[K${message}\n\n`);
    } else {
      this.stream.write(`${message}\n\n`);
    }
  }

  public fail(error?: unknown): void {
    if (this.stopped || this.startTime === 0) {
      return;
    }

    this.stop();

    if (this.isJson) {
      return;
    }

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const isTimeout =
      error instanceof LighthouseTimeoutError ||
      (error as Error)?.name === 'LighthouseTimeoutError' ||
      (error as Error)?.message?.toLowerCase().includes('timed out');

    const message = isTimeout
      ? `✖ Measurement timed out after ${elapsed}s`
      : `✖ Measurement failed after ${elapsed}s`;

    if (this.isTTY) {
      this.stream.write(`\r\x1b[K${message}\n`);
    } else {
      this.stream.write(`${message}\n`);
    }
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private renderTTY(): void {
    const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length];
    this.frameIndex++;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.stream.write(`\r\x1b[K${frame} ${this.taskLabel} [${this.device}] → ${this.status} (${elapsed}s)`);
  }
}

export function createMeasurementProgress(
  options: MeasurementProgressOptions
): MeasurementProgress {
  return new MeasurementProgress(options);
}
