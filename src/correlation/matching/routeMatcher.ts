/**
 * Deterministic Route Matching Utilities
 */

import { type RouteEvidence } from '../../codebase/types.js';
import { normalizeUrl } from './urlMatcher.js';

export type RouteMatchType = 'exact' | 'dynamic' | 'root' | 'none';

export interface RouteMatchResult {
  matchType: RouteMatchType;
  matchedRoute?: RouteEvidence;
  reason: string;
}

/**
 * Converts a framework dynamic route path (e.g. '/blog/[slug]', '/docs/[...catchAll]') into a RegExp.
 */
export function dynamicRouteToRegExp(routePath: string): RegExp {
  const normalized = routePath.replace(/\\/g, '/');
  const segments = normalized.split('/');

  const regexSegments = segments.map((seg) => {
    if (!seg) return '';
    // Optional catch-all: [[...param]]
    if (/^\[\[\.\.\.([^\]]+)\]\]$/.test(seg)) {
      return '(?:.*)?';
    }
    // Catch-all: [...param]
    if (/^\[\.\.\.([^\]]+)\]$/.test(seg)) {
      return '(.+)';
    }
    // Single segment param: [param]
    if (/^\[([^\]]+)\]$/.test(seg)) {
      return '([^/]+)';
    }
    // Static segment: escape regex special chars
    return seg.replace(/[.+*?^$()|[\]{}]/g, '\\$&');
  });

  return new RegExp(`^${regexSegments.join('/')}$`, 'i');
}

/**
 * Matches target browser URL path against scanned codebase routes.
 */
export function matchRoute(targetUrl: string, routes: RouteEvidence[]): RouteMatchResult {
  if (!targetUrl || !routes || routes.length === 0) {
    return {
      matchType: 'none',
      reason: 'No routes available for matching.'
    };
  }

  const norm = normalizeUrl(targetUrl);
  let targetPath = norm.pathname.toLowerCase();

  // Normalize root and trailing slashes
  if (targetPath.length > 1 && targetPath.endsWith('/')) {
    targetPath = targetPath.slice(0, -1);
  }

  // 1. Exact static match
  for (const r of routes) {
    if (!r.isDynamic) {
      let rPath = r.path.toLowerCase().replace(/\\/g, '/');
      if (rPath.length > 1 && rPath.endsWith('/')) {
        rPath = rPath.slice(0, -1);
      }
      if (rPath === targetPath) {
        return {
          matchType: rPath === '/' ? 'root' : 'exact',
          matchedRoute: r,
          reason: `Exact static route match: target URL path '${targetPath}' matches route '${r.path}' (${r.sourceFile}).`
        };
      }
    }
  }

  // 2. Dynamic route match
  for (const r of routes) {
    if (r.isDynamic) {
      const regex = dynamicRouteToRegExp(r.path);
      if (regex.test(targetPath)) {
        return {
          matchType: 'dynamic',
          matchedRoute: r,
          reason: `Dynamic route match: target URL path '${targetPath}' matches dynamic pattern '${r.path}' (${r.sourceFile}).`
        };
      }
    }
  }

  return {
    matchType: 'none',
    reason: `No scanned route matches target URL path '${targetPath}'.`
  };
}
