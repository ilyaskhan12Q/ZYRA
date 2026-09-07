/**
 * Deterministic Script-to-Codebase Matching Utilities
 */

import { type CodebaseEvidence } from '../../codebase/types.js';
import { normalizeUrl } from './urlMatcher.js';
import { matchResourceToAsset } from './assetMatcher.js';

export type ScriptRelationship =
  | 'SCRIPT_LOADED_FROM_ENTRY'
  | 'SCRIPT_REFERENCED_BY_IMPORT'
  | 'SCRIPT_MATCHED_TO_ASSET'
  | 'DEPENDENCY_ASSOCIATION'
  | 'EXTERNAL_SCRIPT'
  | 'UNRESOLVED';

export interface ScriptMatchResult {
  relationship: ScriptRelationship;
  isExternal: boolean;
  targetRef?: string;
  targetType: 'asset' | 'entryPoint' | 'dependency' | 'external_resource' | 'unknown';
  matchedEntityName?: string;
  reason: string;
}

/**
 * Common third-party domain substrings.
 */
const KNOWN_THIRD_PARTY_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'clarity.ms',
  'hotjar.com',
  'segment.io',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'googlesyndication.com'
];

/**
 * Correlates a browser script URL with codebase entities.
 */
export function matchScriptToCodebase(
  scriptUrl: string,
  targetOrigin: string | undefined,
  codebase: CodebaseEvidence
): ScriptMatchResult {
  if (!scriptUrl) {
    return {
      relationship: 'UNRESOLVED',
      isExternal: false,
      targetType: 'unknown',
      reason: 'Empty script URL provided.'
    };
  }

  const norm = normalizeUrl(scriptUrl, targetOrigin);

  // 1. Check if external third party
  const isKnownThirdParty = KNOWN_THIRD_PARTY_PATTERNS.some((p) =>
    (norm.origin || '').toLowerCase().includes(p) || norm.raw.toLowerCase().includes(p)
  );

  if (norm.isExternal || isKnownThirdParty) {
    return {
      relationship: 'EXTERNAL_SCRIPT',
      isExternal: true,
      targetType: 'external_resource',
      targetRef: norm.raw,
      matchedEntityName: norm.origin || norm.raw,
      reason: `External third-party script loaded from origin '${norm.origin ?? norm.raw}'. No local codebase source exists.`
    };
  }

  // 2. Check if script matches a static asset in workspace (e.g. public/scripts/...)
  const scriptAssets = codebase.assets.filter((a) => a.category === 'script' || a.extension === '.js' || a.extension === '.mjs');
  const assetMatch = matchResourceToAsset(scriptUrl, targetOrigin, scriptAssets);

  if (assetMatch.matchType === 'exact' && assetMatch.matchedAsset) {
    return {
      relationship: 'SCRIPT_MATCHED_TO_ASSET',
      isExternal: false,
      targetType: 'asset',
      targetRef: assetMatch.matchedAsset.relativePath,
      matchedEntityName: assetMatch.matchedAsset.relativePath,
      reason: `Script URL matches static workspace asset '${assetMatch.matchedAsset.relativePath}'.`
    };
  }

  // 3. Check if script correlates with application entry points
  // Bundlers typically emit entry bundles like main.js, app.js, index.js matching entry point files
  const filenameWithoutHash = norm.normalizedBasename.toLowerCase();
  for (const entry of codebase.entryPoints) {
    const entryBasename = entry.path.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
    const nameWithoutExt = entryBasename.replace(/\.[^.]+$/, '');

    if (filenameWithoutHash.startsWith(nameWithoutExt) || filenameWithoutHash.includes(nameWithoutExt)) {
      return {
        relationship: 'SCRIPT_LOADED_FROM_ENTRY',
        isExternal: false,
        targetType: 'entryPoint',
        targetRef: entry.path,
        matchedEntityName: entry.path,
        reason: `Script bundle '${norm.filename}' correlates with detected application entry point '${entry.path}'.`
      };
    }
  }

  // 4. Check if script name correlates with a production dependency (vendor chunk)
  for (const dep of codebase.dependencies) {
    const cleanDepName = dep.name.replace(/^@/, '').replace(/\//g, '-').toLowerCase();
    if (filenameWithoutHash.includes(cleanDepName) || norm.filename.toLowerCase().includes(cleanDepName)) {
      return {
        relationship: 'DEPENDENCY_ASSOCIATION',
        isExternal: false,
        targetType: 'dependency',
        targetRef: dep.name,
        matchedEntityName: `${dep.name}@${dep.versionRange}`,
        reason: `Script vendor bundle '${norm.filename}' associates with project dependency '${dep.name}'.`
      };
    }
  }

  // 5. If it is a local bundle but cannot be traced to specific source without source maps
  return {
    relationship: 'UNRESOLVED',
    isExternal: false,
    targetType: 'unknown',
    targetRef: norm.pathname,
    matchedEntityName: norm.filename,
    reason: `Script '${norm.filename}' was served locally, but cannot be attributed to a specific source file without source map mappings.`
  };
}
