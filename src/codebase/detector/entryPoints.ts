import { type EntryPointEvidence, type FileInventoryItem } from '../types.js';

export function detectEntryPoints(
  files: readonly FileInventoryItem[],
  frameworkName?: string
): EntryPointEvidence[] {
  const fileSet = new Set(files.map((f) => f.relativePath));
  const results: EntryPointEvidence[] = [];

  const candidates: Array<{
    paths: string[];
    reason: string;
    framework?: string;
  }> = [
    // Next.js App Router root layout
    {
      paths: ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.js'],
      reason: 'Next.js App Router Root Layout',
      framework: 'Next.js'
    },
    // Next.js Pages Router _app
    {
      paths: ['pages/_app.tsx', 'pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.tsx', 'src/pages/_app.js'],
      reason: 'Next.js Pages Router Root Component',
      framework: 'Next.js'
    },
    // Vite / React / Vue main entry
    {
      paths: [
        'src/main.tsx',
        'src/main.jsx',
        'src/main.ts',
        'src/main.js',
        'main.tsx',
        'main.jsx',
        'main.ts',
        'main.js'
      ],
      reason: 'Standard Application Main Entry Point',
      framework: frameworkName
    },
    // Index entries
    {
      paths: ['src/index.tsx', 'src/index.jsx', 'src/index.ts', 'src/index.js', 'index.ts', 'index.js'],
      reason: 'Standard Module or Application Index Entry Point',
      framework: frameworkName
    },
    // App components
    {
      paths: ['src/App.tsx', 'src/App.jsx', 'src/App.vue', 'src/App.svelte'],
      reason: 'Root Application Component',
      framework: frameworkName
    },
    // SvelteKit root layout
    {
      paths: ['src/routes/+layout.svelte', 'src/routes/+layout.ts', 'src/routes/+layout.js'],
      reason: 'SvelteKit Root Layout',
      framework: 'SvelteKit'
    }
  ];

  for (const candidate of candidates) {
    for (const p of candidate.paths) {
      if (fileSet.has(p)) {
        results.push({
          path: p,
          detectionReason: candidate.reason,
          framework: candidate.framework,
          evidenceRefs: [p]
        });
        // Stop after finding the first matching extension for this category
        break;
      }
    }
  }

  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}
