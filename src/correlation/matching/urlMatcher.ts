/**
 * Deterministic URL and Path Normalization Utilities
 */

export interface NormalizedUrl {
  raw: string;
  isAbsolute: boolean;
  isExternal: boolean;
  origin?: string;
  pathname: string;
  filename: string;
  normalizedBasename: string;
  extension: string;
  searchParams: Record<string, string>;
}

/**
 * Strips common bundler content hashes from filenames (e.g. Vite, Webpack, Rollup).
 * Examples:
 *   - hero.d41d8cd9.webp -> hero.webp
 *   - chunk-4a8b1c2d.js -> chunk.js
 *   - main.5f3e2a1b.esm.js -> main.esm.js
 *   - vendor-1a2b3c4d5e6f7a8b.min.js -> vendor.min.js
 */
export function stripBundlerHash(filename: string): string {
  // Pattern 1: Dot-separated hex/alphanumeric hash before extensions: name.[hash].ext or name.[hash].esm.js
  let result = filename.replace(/\.([a-f0-9]{8,64}|[a-zA-Z0-9_-]{8,32})\.((?:[a-zA-Z0-9]+\.)*[a-zA-Z0-9]+)$/i, '.$2');

  // Pattern 2: Dash-separated hex hash: name-[hash].ext or name-[hash].min.js
  result = result.replace(/-([a-f0-9]{8,64})\.((?:[a-zA-Z0-9]+\.)*[a-zA-Z0-9]+)$/i, '.$2');

  return result;
}

/**
 * Normalizes a URL or path, stripping hashes, queries, and determining external status.
 */
export function normalizeUrl(rawUrl: string, targetOrigin?: string): NormalizedUrl {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      raw: '',
      isAbsolute: false,
      isExternal: false,
      pathname: '',
      filename: '',
      normalizedBasename: '',
      extension: '',
      searchParams: {}
    };
  }

  const trimmed = rawUrl.trim();
  const isAbsolute = /^https?:\/\//i.test(trimmed);

  let origin: string | undefined;
  let pathname = '';
  const searchParams: Record<string, string> = {};

  if (isAbsolute) {
    try {
      const parsed = new URL(trimmed);
      origin = parsed.origin;
      pathname = parsed.pathname;
      parsed.searchParams.forEach((val, key) => {
        searchParams[key] = val;
      });
    } catch {
      // Fallback for malformed URLs
      const withoutProto = trimmed.replace(/^https?:\/\//i, '');
      const slashIndex = withoutProto.indexOf('/');
      if (slashIndex !== -1) {
        origin = trimmed.slice(0, trimmed.indexOf(withoutProto) + slashIndex);
        pathname = withoutProto.slice(slashIndex);
      } else {
        pathname = '/';
      }
    }
  } else {
    // Relative path or root-relative URL
    const queryIndex = trimmed.indexOf('?');
    const hashIndex = trimmed.indexOf('#');
    let clean = trimmed;

    if (queryIndex !== -1) {
      const queryString = hashIndex !== -1 && hashIndex > queryIndex
        ? trimmed.slice(queryIndex + 1, hashIndex)
        : trimmed.slice(queryIndex + 1);
      const params = new URLSearchParams(queryString);
      params.forEach((val, key) => {
        searchParams[key] = val;
      });
      clean = trimmed.slice(0, queryIndex);
    } else if (hashIndex !== -1) {
      clean = trimmed.slice(0, hashIndex);
    }

    pathname = clean.startsWith('/') ? clean : `/${clean}`;
  }

  // Ensure POSIX style and strip trailing slash unless root
  pathname = pathname.replace(/\\/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const parts = pathname.split('/');
  const filename = parts[parts.length - 1] || '';
  const extIndex = filename.lastIndexOf('.');
  const extension = extIndex !== -1 ? filename.slice(extIndex).toLowerCase() : '';
  const normalizedBasename = stripBundlerHash(filename);

  let isExternal = false;
  if (isAbsolute && origin && targetOrigin) {
    try {
      const targetUrlObj = new URL(targetOrigin);
      isExternal = parsedOrigin(origin) !== parsedOrigin(targetUrlObj.origin);
    } catch {
      isExternal = origin.toLowerCase() !== targetOrigin.toLowerCase();
    }
  } else if (isAbsolute) {
    isExternal = false; // Cannot definitively determine external without targetOrigin
  }

  return {
    raw: trimmed,
    isAbsolute,
    isExternal,
    origin,
    pathname,
    filename,
    normalizedBasename,
    extension,
    searchParams
  };
}

function parsedOrigin(urlOrOrigin: string): string {
  try {
    const u = new URL(urlOrOrigin);
    return u.hostname.toLowerCase();
  } catch {
    return urlOrOrigin.toLowerCase();
  }
}
