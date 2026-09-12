import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import {
  type LighthouseRunnerOptions,
  type LighthouseRunResult,
  type DeviceType
} from './types.js';
import {
  LighthouseError,
  InvalidUrlError,
  ChromeLaunchError,
  LighthouseTimeoutError,
  LighthouseExecutionError
} from './errors.js';

/**
 * Validate that the given target URL has a valid protocol and hostname.
 */
export function validateTargetUrl(url: string): URL {
  if (!url || typeof url !== 'string') {
    throw new InvalidUrlError(url, 'URL must be a non-empty string.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err: unknown) {
    throw new InvalidUrlError(url, (err as Error).message);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError(
      url,
      `Protocol '${parsed.protocol}' is unsupported. Only 'http:' and 'https:' are supported.`
    );
  }

  return parsed;
}

/**
 * Build Lighthouse flags and configuration based on device type.
 */
function getDeviceSettings(device: DeviceType, port: number) {
  const baseFlags = {
    port,
    output: 'json' as const,
    onlyCategories: ['performance'] as string[],
    logLevel: 'error' as const
  };

  if (device === 'desktop') {
    return {
      flags: {
        ...baseFlags,
        formFactor: 'desktop' as const,
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        }
      }
    };
  }

  // Default: mobile
  return {
    flags: {
      ...baseFlags,
      formFactor: 'mobile' as const,
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        disabled: false
      },
      throttling: {
        rttMs: 150,
        throughputKbps: 1.6 * 1024,
        requestLatencyMs: 562.5,
        downloadThroughputKbps: 1.6 * 1024,
        uploadThroughputKbps: 750,
        cpuSlowdownMultiplier: 4
      }
    }
  };
}

/**
 * Run a Lighthouse performance measurement against a target URL.
 */
export async function runLighthouse(
  options: LighthouseRunnerOptions
): Promise<LighthouseRunResult> {
  const targetUrl = options.url;
  validateTargetUrl(targetUrl);

  const device: DeviceType = options.device ?? 'mobile';
  const timeoutMs = options.timeoutMs ?? 60000;

  let chrome: chromeLauncher.LaunchedChrome | null = null;
  const startTime = Date.now();

  try {
    // Launch headless Chrome if port not explicitly provided
    if (!options.port) {
      options.onProgress?.('Launching Chrome browser...');
      const defaultChromeFlags = [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        ...(options.extraChromeFlags ?? [])
      ];

      try {
        chrome = await chromeLauncher.launch({
          chromeFlags: defaultChromeFlags
        });
      } catch (err: unknown) {
        throw new ChromeLaunchError(
          `Unable to spawn Chrome process: ${(err as Error).message}`,
          err
        );
      }
    }

    const port = options.port ?? chrome!.port;
    const { flags } = getDeviceSettings(device, port);

    // Run Lighthouse with timeout protection
    let timeoutTimer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new LighthouseTimeoutError(timeoutMs));
      }, timeoutMs);
    });

    const executionPromise = (async () => {
      try {
        options.onProgress?.('Running Lighthouse audit...');
        const runnerResult = await lighthouse(targetUrl, flags);
        if (!runnerResult || !runnerResult.lhr) {
          throw new LighthouseExecutionError('Lighthouse finished without producing a report.');
        }
        return runnerResult.lhr;
      } catch (err: unknown) {
        if (err instanceof LighthouseError) {
          throw err;
        }
        throw new LighthouseExecutionError((err as Error).message, err);
      }
    })();

    const rawLhr = await Promise.race([executionPromise, timeoutPromise]);

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }

    const durationMs = Date.now() - startTime;

    return {
      metadata: {
        targetUrl,
        requestedUrl: rawLhr.requestedUrl ?? targetUrl,
        finalDisplayedUrl: rawLhr.finalDisplayedUrl ?? rawLhr.finalUrl ?? targetUrl,
        device,
        timestamp: new Date().toISOString(),
        durationMs,
        lighthouseVersion: rawLhr.lighthouseVersion ?? 'unknown',
        benchmarkIndex: rawLhr.environment?.benchmarkIndex,
        userAgent: rawLhr.userAgent
      },
      rawLhr
    };
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        // Suppress kill error on cleanup
      }
    }
  }
}
