/**
 * Deterministic Resource-to-Asset Matching Utilities
 */

import { type AssetEvidence } from '../../codebase/types.js';
import { normalizeUrl } from './urlMatcher.js';

export type AssetMatchType = 'exact' | 'probable' | 'ambiguous' | 'unmatched';

export interface AssetMatchResult {
  matchType: AssetMatchType;
  matchedAsset?: AssetEvidence;
  candidateAssets: AssetEvidence[];
  reason: string;
}

/**
 * Normalizes an asset relativePath into its public served URL path.
 * For example:
 *   - 'public/images/hero.webp' -> '/images/hero.webp'
 *   - 'static/fonts/inter.woff2' -> '/fonts/inter.woff2'
 *   - 'images/hero.webp' -> '/images/hero.webp'
 */
export function getServedAssetPath(assetRelativePath: string): string {
  let p = assetRelativePath.replace(/\\/g, '/');
  if (p.startsWith('public/')) {
    p = p.slice('public'.length);
  } else if (p.startsWith('static/')) {
    p = p.slice('static'.length);
  }
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  return p;
}

/**
 * Deterministically correlates a network resource URL with scanned codebase assets.
 */
export function matchResourceToAsset(
  resourceUrl: string,
  targetOrigin: string | undefined,
  assets: AssetEvidence[]
): AssetMatchResult {
  if (!resourceUrl || !assets || assets.length === 0) {
    return {
      matchType: 'unmatched',
      candidateAssets: [],
      reason: 'No assets available in workspace for correlation.'
    };
  }

  const normUrl = normalizeUrl(resourceUrl, targetOrigin);

  // If resource is external and does not match any relative structure
  if (normUrl.isExternal) {
    // External resources can still match if CDN mirrors local assets, but we check conservatively
  }

  const urlPath = normUrl.pathname.toLowerCase();
  const urlFilename = normUrl.filename.toLowerCase();
  const strippedFilename = normUrl.normalizedBasename.toLowerCase();
  const ext = normUrl.extension.toLowerCase();

  // 1. Check for Exact Served Path Matches
  // e.g. /images/hero.webp matches asset public/images/hero.webp
  const exactPathMatches: AssetEvidence[] = [];

  for (const asset of assets) {
    const assetRelative = asset.relativePath.replace(/\\/g, '/').toLowerCase();
    const servedPath = getServedAssetPath(asset.relativePath).toLowerCase();

    if (servedPath === urlPath || `/${assetRelative}` === urlPath || assetRelative === urlPath.replace(/^\//, '')) {
      exactPathMatches.push(asset);
    }
  }

  if (exactPathMatches.length === 1) {
    const matched = exactPathMatches[0]!;
    return {
      matchType: 'exact',
      matchedAsset: matched,
      candidateAssets: exactPathMatches,
      reason: `Exact path match: resource URL path '${normUrl.pathname}' matches served asset path '${matched.relativePath}'.`
    };
  }

  if (exactPathMatches.length > 1) {
    return {
      matchType: 'ambiguous',
      candidateAssets: exactPathMatches,
      reason: `Ambiguous match: multiple assets (${exactPathMatches.map((a) => a.relativePath).join(', ')}) share the exact path '${normUrl.pathname}'.`
    };
  }

  // 2. Check for filename / hash-stripped filename matches across assets
  const filenameMatches: AssetEvidence[] = [];

  for (const asset of assets) {
    const assetParts = asset.relativePath.replace(/\\/g, '/').split('/');
    const assetFilename = (assetParts[assetParts.length - 1] || '').toLowerCase();
    const assetExt = asset.extension.toLowerCase();

    if (assetExt === ext && (assetFilename === urlFilename || assetFilename === strippedFilename)) {
      filenameMatches.push(asset);
    }
  }

  if (filenameMatches.length === 1) {
    const matched = filenameMatches[0]!;
    return {
      matchType: 'probable',
      matchedAsset: matched,
      candidateAssets: filenameMatches,
      reason: `Probable match: filename '${normUrl.filename}' uniquely matches asset '${matched.relativePath}'.`
    };
  }

  if (filenameMatches.length > 1) {
    return {
      matchType: 'ambiguous',
      candidateAssets: filenameMatches,
      reason: `Ambiguous match: multiple assets in different directories (${filenameMatches.map((a) => a.relativePath).join(', ')}) match filename '${normUrl.filename}'.`
    };
  }

  return {
    matchType: 'unmatched',
    candidateAssets: [],
    reason: `Unmatched: no scanned asset matches resource '${resourceUrl}'.`
  };
}
