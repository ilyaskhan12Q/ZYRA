import {
  type FrameworkEvidence,
  type FrameworkConfidence,
  type FileInventoryItem,
  type DependencyEvidence
} from '../types.js';

interface FrameworkCandidate {
  name: string;
  version?: string;
  isMetaFramework: boolean;
  signals: string[];
}

export function detectFramework(
  files: readonly FileInventoryItem[],
  dependencies: readonly DependencyEvidence[]
): FrameworkEvidence {
  const fileSet = new Set(files.map((f) => f.relativePath));
  const depMap = new Map<string, string>();
  for (const dep of dependencies) {
    depMap.set(dep.name, dep.versionRange);
  }

  const candidates: FrameworkCandidate[] = [];

  // 1. Next.js check
  const nextDep = depMap.get('next');
  const nextConfigs = files
    .map((f) => f.relativePath)
    .filter((p) => /^next\.config\.(js|mjs|cjs|ts)$/.test(p));
  const hasAppDir = files.some((f) => f.relativePath.startsWith('app/'));
  const hasPagesDir = files.some((f) => f.relativePath.startsWith('pages/'));

  if (nextDep || nextConfigs.length > 0 || hasAppDir || hasPagesDir) {
    const signals: string[] = [];
    if (nextDep) signals.push(`package.json (next@${nextDep})`);
    nextConfigs.forEach((c) => signals.push(c));
    if (hasAppDir) signals.push('app/ (App Router)');
    if (hasPagesDir) signals.push('pages/ (Pages Router)');

    candidates.push({
      name: 'Next.js',
      version: nextDep,
      isMetaFramework: true,
      signals
    });
  }

  // 2. Nuxt check
  const nuxtDep = depMap.get('nuxt');
  const nuxtConfigs = files
    .map((f) => f.relativePath)
    .filter((p) => /^nuxt\.config\.(js|mjs|ts)$/.test(p));

  if (nuxtDep || nuxtConfigs.length > 0) {
    const signals: string[] = [];
    if (nuxtDep) signals.push(`package.json (nuxt@${nuxtDep})`);
    nuxtConfigs.forEach((c) => signals.push(c));

    candidates.push({
      name: 'Nuxt',
      version: nuxtDep,
      isMetaFramework: true,
      signals
    });
  }

  // 3. SvelteKit check
  const svelteKitDep = depMap.get('@sveltejs/kit');
  const svelteConfig = files.find((f) => /^svelte\.config\.(js|cjs|mjs|ts)$/.test(f.relativePath));

  if (svelteKitDep || (svelteConfig && depMap.has('svelte'))) {
    const signals: string[] = [];
    if (svelteKitDep) signals.push(`package.json (@sveltejs/kit@${svelteKitDep})`);
    if (svelteConfig) signals.push(svelteConfig.relativePath);

    candidates.push({
      name: 'SvelteKit',
      version: svelteKitDep,
      isMetaFramework: true,
      signals
    });
  }

  // 4. Astro check
  const astroDep = depMap.get('astro');
  const astroConfigs = files
    .map((f) => f.relativePath)
    .filter((p) => /^astro\.config\.(js|mjs|ts)$/.test(p));

  if (astroDep || astroConfigs.length > 0) {
    const signals: string[] = [];
    if (astroDep) signals.push(`package.json (astro@${astroDep})`);
    astroConfigs.forEach((c) => signals.push(c));

    candidates.push({
      name: 'Astro',
      version: astroDep,
      isMetaFramework: true,
      signals
    });
  }

  // 5. Angular check
  const angularDep = depMap.get('@angular/core');
  const angularJson = fileSet.has('angular.json');

  if (angularDep || angularJson) {
    const signals: string[] = [];
    if (angularDep) signals.push(`package.json (@angular/core@${angularDep})`);
    if (angularJson) signals.push('angular.json');

    candidates.push({
      name: 'Angular',
      version: angularDep,
      isMetaFramework: true,
      signals
    });
  }

  // 6. Vite check
  const viteDep = depMap.get('vite');
  const viteConfigs = files
    .map((f) => f.relativePath)
    .filter((p) => /^vite\.config\.(js|mjs|cjs|ts)$/.test(p));

  if (viteDep || viteConfigs.length > 0) {
    const signals: string[] = [];
    if (viteDep) signals.push(`package.json (vite@${viteDep})`);
    viteConfigs.forEach((c) => signals.push(c));

    candidates.push({
      name: 'Vite',
      version: viteDep,
      isMetaFramework: false,
      signals
    });
  }

  // 7. Base UI libraries: React, Vue, Svelte
  const reactDep = depMap.get('react');
  const vueDep = depMap.get('vue');
  const svelteDep = depMap.get('svelte');

  if (reactDep) {
    candidates.push({
      name: 'React',
      version: reactDep,
      isMetaFramework: false,
      signals: [`package.json (react@${reactDep})`]
    });
  }
  if (vueDep) {
    candidates.push({
      name: 'Vue',
      version: vueDep,
      isMetaFramework: false,
      signals: [`package.json (vue@${vueDep})`]
    });
  }
  if (svelteDep && !candidates.some((c) => c.name === 'SvelteKit')) {
    candidates.push({
      name: 'Svelte',
      version: svelteDep,
      isMetaFramework: false,
      signals: [`package.json (svelte@${svelteDep})`]
    });
  }

  // Ambiguity check among meta-frameworks
  const metaCandidates = candidates.filter((c) => c.isMetaFramework);
  if (metaCandidates.length > 1) {
    const allSignals = metaCandidates.flatMap((c) => c.signals);
    return {
      name: metaCandidates.map((c) => c.name).join(' / '),
      confidence: 'ambiguous',
      evidenceRefs: allSignals,
      details: {
        candidates: metaCandidates.map((c) => ({ name: c.name, signals: c.signals }))
      }
    };
  }

  // If a single meta-framework is present, it takes primary precedence
  if (metaCandidates.length === 1) {
    const primary = metaCandidates[0];
    const confidence: FrameworkConfidence = primary.signals.length >= 2 ? 'detected' : 'probable';
    return {
      name: primary.name,
      confidence,
      version: primary.version,
      evidenceRefs: primary.signals,
      details: {
        primary: primary.name,
        supporting: candidates.filter((c) => !c.isMetaFramework).map((c) => c.name)
      }
    };
  }

  // If Vite + UI library
  const viteCandidate = candidates.find((c) => c.name === 'Vite');
  const uiCandidate = candidates.find((c) => ['React', 'Vue', 'Svelte'].includes(c.name));

  if (viteCandidate && uiCandidate) {
    const combinedName = `${uiCandidate.name} (Vite)`;
    const allSignals = [...uiCandidate.signals, ...viteCandidate.signals];
    const confidence: FrameworkConfidence =
      viteCandidate.signals.length >= 2 ? 'detected' : 'probable';
    return {
      name: combinedName,
      confidence,
      version: uiCandidate.version,
      evidenceRefs: allSignals
    };
  }

  if (viteCandidate) {
    return {
      name: 'Vite',
      confidence: viteCandidate.signals.length >= 2 ? 'detected' : 'probable',
      version: viteCandidate.version,
      evidenceRefs: viteCandidate.signals
    };
  }

  if (uiCandidate) {
    return {
      name: uiCandidate.name,
      confidence: 'probable',
      version: uiCandidate.version,
      evidenceRefs: uiCandidate.signals
    };
  }

  return {
    name: 'unknown',
    confidence: 'unknown',
    evidenceRefs: []
  };
}
