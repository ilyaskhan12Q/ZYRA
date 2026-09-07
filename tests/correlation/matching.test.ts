import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeUrl,
  stripBundlerHash,
  matchResourceToAsset,
  getServedAssetPath,
  matchRoute,
  dynamicRouteToRegExp,
  matchScriptToCodebase
} from '../../src/correlation/matching/index.js';
import { type AssetEvidence, type RouteEvidence, type CodebaseEvidence } from '../../src/codebase/types.js';

describe('Correlation Matching — URL Normalization & Hash Stripping', () => {
  it('strips common bundler content hashes from filenames', () => {
    assert.strictEqual(stripBundlerHash('hero.d41d8cd9.webp'), 'hero.webp');
    assert.strictEqual(stripBundlerHash('chunk-4a8b1c2d.js'), 'chunk.js');
    assert.strictEqual(stripBundlerHash('main.5f3e2a1b.esm.js'), 'main.esm.js');
    assert.strictEqual(stripBundlerHash('vendor-1a2b3c4d5e6f7a8b.min.js'), 'vendor.min.js');
    assert.strictEqual(stripBundlerHash('normal-file.png'), 'normal-file.png');
  });

  it('normalizes absolute URLs, extracting pathname, filename, and query params', () => {
    const res = normalizeUrl('https://example.com/assets/hero.12345678.webp?v=2#details', 'https://example.com');
    assert.strictEqual(res.isAbsolute, true);
    assert.strictEqual(res.isExternal, false);
    assert.strictEqual(res.pathname, '/assets/hero.12345678.webp');
    assert.strictEqual(res.filename, 'hero.12345678.webp');
    assert.strictEqual(res.normalizedBasename, 'hero.webp');
    assert.strictEqual(res.extension, '.webp');
    assert.strictEqual(res.searchParams.v, '2');
  });

  it('detects external third-party origins relative to target', () => {
    const res = normalizeUrl('https://cdn.thirdparty.com/analytics.js', 'https://my-app.com');
    assert.strictEqual(res.isExternal, true);
    assert.strictEqual(res.origin, 'https://cdn.thirdparty.com');
  });

  it('normalizes relative and root-relative paths', () => {
    const res1 = normalizeUrl('/images/logo.svg?theme=dark');
    assert.strictEqual(res1.pathname, '/images/logo.svg');
    assert.strictEqual(res1.filename, 'logo.svg');
    assert.strictEqual(res1.extension, '.svg');
    assert.strictEqual(res1.searchParams.theme, 'dark');

    const res2 = normalizeUrl('scripts/bundle.js');
    assert.strictEqual(res2.pathname, '/scripts/bundle.js');
  });
});

describe('Correlation Matching — Resource-to-Asset Matching', () => {
  const assets: AssetEvidence[] = [
    {
      relativePath: 'public/images/hero.webp',
      extension: '.webp',
      category: 'image',
      sizeBytes: 850000
    },
    {
      relativePath: 'public/favicon.ico',
      extension: '.ico',
      category: 'image',
      sizeBytes: 15000
    },
    {
      relativePath: 'src/assets/logo.png',
      extension: '.png',
      category: 'image',
      sizeBytes: 45000
    },
    {
      relativePath: 'public/brand/logo.png',
      extension: '.png',
      category: 'image',
      sizeBytes: 90000
    },
    {
      relativePath: 'static/fonts/inter.woff2',
      extension: '.woff2',
      category: 'font',
      sizeBytes: 42000
    }
  ];

  it('derives correct served public path from relative asset paths', () => {
    assert.strictEqual(getServedAssetPath('public/images/hero.webp'), '/images/hero.webp');
    assert.strictEqual(getServedAssetPath('static/fonts/inter.woff2'), '/fonts/inter.woff2');
    assert.strictEqual(getServedAssetPath('images/pic.png'), '/images/pic.png');
  });

  it('finds exact match when served asset path matches URL pathname', () => {
    const match = matchResourceToAsset('https://example.com/images/hero.webp', 'https://example.com', assets);
    assert.strictEqual(match.matchType, 'exact');
    assert.strictEqual(match.matchedAsset?.relativePath, 'public/images/hero.webp');
  });

  it('finds exact match when bundler hash is present in URL', () => {
    const match = matchResourceToAsset('https://example.com/images/hero.d41d8cd9.webp', 'https://example.com', assets);
    assert.strictEqual(match.matchType, 'probable');
    assert.strictEqual(match.matchedAsset?.relativePath, 'public/images/hero.webp');
  });

  it('identifies ambiguous match when multiple assets in different directories share filename', () => {
    // Both src/assets/logo.png and public/brand/logo.png exist
    const match = matchResourceToAsset('https://example.com/logo.png', 'https://example.com', assets);
    assert.strictEqual(match.matchType, 'ambiguous');
    assert.strictEqual(match.candidateAssets.length, 2);
    assert.strictEqual(match.matchedAsset, undefined);
  });

  it('resolves exact match despite ambiguity if full path matches one candidate', () => {
    // Requesting /brand/logo.png explicitly matches public/brand/logo.png
    const match = matchResourceToAsset('https://example.com/brand/logo.png', 'https://example.com', assets);
    assert.strictEqual(match.matchType, 'exact');
    assert.strictEqual(match.matchedAsset?.relativePath, 'public/brand/logo.png');
  });

  it('returns unmatched when resource does not exist in workspace', () => {
    const match = matchResourceToAsset('https://example.com/images/missing.jpg', 'https://example.com', assets);
    assert.strictEqual(match.matchType, 'unmatched');
    assert.strictEqual(match.matchedAsset, undefined);
  });
});

describe('Correlation Matching — Route Matching', () => {
  const routes: RouteEvidence[] = [
    {
      path: '/',
      sourceFile: 'src/app/page.tsx',
      framework: 'Next.js (App Router)',
      detectionMethod: 'filesystem',
      isDynamic: false,
      evidenceRefs: []
    },
    {
      path: '/about',
      sourceFile: 'src/app/about/page.tsx',
      framework: 'Next.js (App Router)',
      detectionMethod: 'filesystem',
      isDynamic: false,
      evidenceRefs: []
    },
    {
      path: '/blog/[slug]',
      sourceFile: 'src/app/blog/[slug]/page.tsx',
      framework: 'Next.js (App Router)',
      detectionMethod: 'filesystem',
      isDynamic: true,
      evidenceRefs: []
    },
    {
      path: '/docs/[...catchAll]',
      sourceFile: 'src/app/docs/[...catchAll]/page.tsx',
      framework: 'Next.js (App Router)',
      detectionMethod: 'filesystem',
      isDynamic: true,
      evidenceRefs: []
    }
  ];

  it('converts framework dynamic route syntax into valid regex', () => {
    const regex1 = dynamicRouteToRegExp('/blog/[slug]');
    assert.strictEqual(regex1.test('/blog/my-first-post'), true);
    assert.strictEqual(regex1.test('/blog/my-first-post/extra'), false);

    const regex2 = dynamicRouteToRegExp('/docs/[...catchAll]');
    assert.strictEqual(regex2.test('/docs/intro'), true);
    assert.strictEqual(regex2.test('/docs/api/v1/users'), true);
  });

  it('matches root URL path to root route', () => {
    const match = matchRoute('https://example.com/', routes);
    assert.strictEqual(match.matchType, 'root');
    assert.strictEqual(match.matchedRoute?.path, '/');
    assert.strictEqual(match.matchedRoute?.sourceFile, 'src/app/page.tsx');
  });

  it('matches static route exactly', () => {
    const match = matchRoute('https://example.com/about', routes);
    assert.strictEqual(match.matchType, 'exact');
    assert.strictEqual(match.matchedRoute?.path, '/about');
  });

  it('matches dynamic route pattern correctly', () => {
    const match = matchRoute('https://example.com/blog/hello-world', routes);
    assert.strictEqual(match.matchType, 'dynamic');
    assert.strictEqual(match.matchedRoute?.path, '/blog/[slug]');
    assert.strictEqual(match.matchedRoute?.sourceFile, 'src/app/blog/[slug]/page.tsx');
  });

  it('matches catch-all dynamic route correctly', () => {
    const match = matchRoute('https://example.com/docs/getting-started/installation', routes);
    assert.strictEqual(match.matchType, 'dynamic');
    assert.strictEqual(match.matchedRoute?.path, '/docs/[...catchAll]');
  });

  it('returns none when route does not match any pattern', () => {
    const match = matchRoute('https://example.com/contact-us', routes);
    assert.strictEqual(match.matchType, 'none');
    assert.strictEqual(match.matchedRoute, undefined);
  });
});

describe('Correlation Matching — Script & Codebase Matching', () => {
  const dummyCodebase: CodebaseEvidence = {
    schemaVersion: '1.0',
    workspace: {
      root: '/app',
      scannedAt: new Date().toISOString(),
      scannerVersion: '1.0',
      stats: { filesScanned: 10, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
    },
    framework: { name: 'React', confidence: 'detected', evidenceRefs: [] },
    packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
    runtime: { evidenceRefs: [] },
    dependencies: [
      { name: 'lodash', versionRange: '^4.17.21', dependencyType: 'production', sourceManifest: 'package.json' }
    ],
    files: [],
    routes: [],
    entryPoints: [
      { path: 'src/main.tsx', detectionReason: 'Vite main entry point', evidenceRefs: [] }
    ],
    assets: [
      { relativePath: 'public/scripts/tracker.js', extension: '.js', category: 'script', sizeBytes: 12000 }
    ],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
    warnings: []
  };

  it('detects external third-party script', () => {
    const res = matchScriptToCodebase(
      'https://www.googletagmanager.com/gtag/js?id=G-12345',
      'https://my-app.com',
      dummyCodebase
    );
    assert.strictEqual(res.relationship, 'EXTERNAL_SCRIPT');
    assert.strictEqual(res.isExternal, true);
    assert.strictEqual(res.targetType, 'external_resource');
  });

  it('matches static script asset in workspace', () => {
    const res = matchScriptToCodebase(
      'https://my-app.com/scripts/tracker.js',
      'https://my-app.com',
      dummyCodebase
    );
    assert.strictEqual(res.relationship, 'SCRIPT_MATCHED_TO_ASSET');
    assert.strictEqual(res.targetRef, 'public/scripts/tracker.js');
  });

  it('correlates entry bundle with application entry point', () => {
    const res = matchScriptToCodebase(
      'https://my-app.com/assets/main.d41d8cd9.js',
      'https://my-app.com',
      dummyCodebase
    );
    assert.strictEqual(res.relationship, 'SCRIPT_LOADED_FROM_ENTRY');
    assert.strictEqual(res.targetRef, 'src/main.tsx');
  });

  it('associates vendor chunk with production dependency', () => {
    const res = matchScriptToCodebase(
      'https://my-app.com/assets/vendor-lodash.js',
      'https://my-app.com',
      dummyCodebase
    );
    assert.strictEqual(res.relationship, 'DEPENDENCY_ASSOCIATION');
    assert.strictEqual(res.targetRef, 'lodash');
  });
});
