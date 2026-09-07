import { type RouteEvidence, type FileInventoryItem } from '../types.js';

export function detectRoutes(files: readonly FileInventoryItem[]): RouteEvidence[] {
  const routes: RouteEvidence[] = [];

  for (const file of files) {
    const rel = file.relativePath;

    // 1. Next.js App Router: app/**/page.* or src/app/**/page.*
    const appMatch = rel.match(/^(?:src\/)?app\/(.+)\/page\.(?:tsx|jsx|ts|js)$/);
    const appRootMatch = rel.match(/^(?:src\/)?app\/page\.(?:tsx|jsx|ts|js)$/);

    if (appRootMatch) {
      routes.push({
        path: '/',
        sourceFile: rel,
        framework: 'Next.js (App Router)',
        detectionMethod: 'convention:app-router',
        isDynamic: false,
        evidenceRefs: [rel]
      });
      continue;
    }

    if (appMatch) {
      const segmentPath = appMatch[1];
      // Strip Next.js route groups like (marketing), (auth)
      const segments = segmentPath
        .split('/')
        .filter((s) => !/^\(.+\)$/.test(s) && !/^@.+$/.test(s)); // exclude parallel routes (@modal)

      const derivedPath = '/' + segments.join('/');
      const isDynamic = derivedPath.includes('[') && derivedPath.includes(']');

      routes.push({
        path: derivedPath === '' ? '/' : derivedPath,
        sourceFile: rel,
        framework: 'Next.js (App Router)',
        detectionMethod: 'convention:app-router',
        isDynamic,
        evidenceRefs: [rel]
      });
      continue;
    }

    // 2. Next.js Pages Router: pages/**/* or src/pages/**/*
    const pagesMatch = rel.match(/^(?:src\/)?pages\/(.+)\.(?:tsx|jsx|ts|js)$/);
    if (pagesMatch) {
      const pageInner = pagesMatch[1];
      // Skip Next.js internal pages and API routes
      if (
        pageInner.startsWith('_app') ||
        pageInner.startsWith('_document') ||
        pageInner.startsWith('_error') ||
        pageInner.startsWith('api/') ||
        pageInner === 'api'
      ) {
        continue;
      }

      let derivedPath: string;
      if (pageInner === 'index') {
        derivedPath = '/';
      } else if (pageInner.endsWith('/index')) {
        derivedPath = '/' + pageInner.replace(/\/index$/, '');
      } else {
        derivedPath = '/' + pageInner;
      }

      const isDynamic = derivedPath.includes('[') && derivedPath.includes(']');
      routes.push({
        path: derivedPath,
        sourceFile: rel,
        framework: 'Next.js (Pages Router)',
        detectionMethod: 'convention:pages-router',
        isDynamic,
        evidenceRefs: [rel]
      });
      continue;
    }

    // 3. SvelteKit Router: src/routes/**/+page.*
    const svelteKitMatch = rel.match(/^src\/routes\/(.+)\/\+page\.(?:svelte|ts|js)$/);
    const svelteKitRootMatch = rel.match(/^src\/routes\/\+page\.(?:svelte|ts|js)$/);

    if (svelteKitRootMatch) {
      routes.push({
        path: '/',
        sourceFile: rel,
        framework: 'SvelteKit',
        detectionMethod: 'convention:sveltekit',
        isDynamic: false,
        evidenceRefs: [rel]
      });
      continue;
    }

    if (svelteKitMatch) {
      const segmentPath = svelteKitMatch[1];
      const segments = segmentPath.split('/').filter((s) => !/^\(.+\)$/.test(s));
      const derivedPath = '/' + segments.join('/');
      const isDynamic = derivedPath.includes('[') && derivedPath.includes(']');

      routes.push({
        path: derivedPath === '' ? '/' : derivedPath,
        sourceFile: rel,
        framework: 'SvelteKit',
        detectionMethod: 'convention:sveltekit',
        isDynamic,
        evidenceRefs: [rel]
      });
      continue;
    }

    // 4. Astro Router: src/pages/**/*.{astro,md,mdx}
    const astroMatch = rel.match(/^src\/pages\/(.+)\.(?:astro|md|mdx)$/);
    if (astroMatch) {
      const pageInner = astroMatch[1];
      let derivedPath: string;
      if (pageInner === 'index') {
        derivedPath = '/';
      } else if (pageInner.endsWith('/index')) {
        derivedPath = '/' + pageInner.replace(/\/index$/, '');
      } else {
        derivedPath = '/' + pageInner;
      }

      const isDynamic = derivedPath.includes('[') && derivedPath.includes(']');
      routes.push({
        path: derivedPath,
        sourceFile: rel,
        framework: 'Astro',
        detectionMethod: 'convention:astro',
        isDynamic,
        evidenceRefs: [rel]
      });
      continue;
    }
  }

  // Deduplicate and sort deterministically by path
  const seenPaths = new Set<string>();
  const uniqueRoutes: RouteEvidence[] = [];

  for (const r of routes) {
    const key = `${r.path}:${r.sourceFile}`;
    if (!seenPaths.has(key)) {
      seenPaths.add(key);
      uniqueRoutes.push(r);
    }
  }

  uniqueRoutes.sort((a, b) => {
    const cmp = a.path.localeCompare(b.path);
    if (cmp !== 0) return cmp;
    return a.sourceFile.localeCompare(b.sourceFile);
  });

  return uniqueRoutes;
}
